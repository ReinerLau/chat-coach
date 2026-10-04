import { createHash } from 'node:crypto'
import { readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { SqliteWcdb } from './sqlite-wcdb.js'

function tableName(username) { return `Msg_${createHash('md5').update(username).digest('hex')}` }

export class WcdbSource {
  constructor({ libraryPath, accountRoot, key }) {
    this.db = new SqliteWcdb(libraryPath, key)
    this.root = join(accountRoot, 'db_storage')
    this.sessionDb = join(this.root, 'session/session.db')
    this.contactDb = join(this.root, 'contact/contact.db')
    this.messageDbs = readdirSync(join(this.root, 'message')).filter((name) => /^message_\d+\.db$/.test(name)).map((name) => join(this.root, 'message', name))
    this.ownUsername = basename(accountRoot).replace(/_[a-f0-9]{4}$/i, '')
    this.tableBySession = new Map()
    this.senderByDb = new Map()
  }

  refresh() {
    this.tableBySession.clear()
    this.senderByDb.clear()
    const candidates = new Set(this.db.query(this.sessionDb, 'SELECT username FROM SessionTable').map((row) => row.username))
    for (const path of this.messageDbs) {
      const names = this.db.query(path, 'SELECT user_name FROM Name2Id').map((row) => row.user_name)
      for (const name of names) candidates.add(name)
      const senders = new Map(this.db.query(path, 'SELECT rowid,user_name FROM Name2Id').map((row) => [Number(row.rowid), row.user_name]))
      this.senderByDb.set(path, senders)
      const tables = new Set(this.db.query(path, "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'Msg_%'").map((row) => row.name))
      for (const username of candidates) {
        if (!username || !tables.has(tableName(username))) continue
        const list = this.tableBySession.get(username) ?? []
        list.push(path)
        this.tableBySession.set(username, list)
      }
    }
  }

  sessions() {
    this.refresh()
    const contacts = new Map(this.db.query(this.contactDb, 'SELECT username,alias,remark,nick_name FROM contact').map((row) => [row.username, row]))
    return [...this.tableBySession.keys()].map((username) => {
      const contact = contacts.get(username)
      return { username, nickname: contact?.remark || contact?.nick_name || contact?.alias || username }
    })
  }

  messages(sessionId, limit, offset) {
    const rows = []
    for (const page of this.messagePages(sessionId, 200)) {
      for (const row of page) {
        if (offset > 0) { offset--; continue }
        rows.push(row)
        if (rows.length >= limit) return rows
      }
    }
    return rows
  }

  *messagePages(sessionId, pageSize) {
    const paths = this.tableBySession.get(sessionId) ?? []
    const table = tableName(sessionId)
    const cursors = []
    for (const path of paths) {
      const shard = Number(basename(path).match(/\d+/)?.[0] ?? 0)
      const senders = this.senderByDb.get(path)
      const iterator = this.db.iterate(path, `SELECT local_id,server_id,local_type,real_sender_id,create_time,message_content FROM "${table}" ORDER BY create_time DESC, local_id DESC`)
      cursors.push({ iterator, head: iterator.next(), shard, senders })
    }
    try {
      let page = []
      while (true) {
        const active = cursors.filter((cursor) => !cursor.head.done)
        if (!active.length) break
        active.sort((a, b) => Number(b.head.value.create_time) - Number(a.head.value.create_time) || Number(b.head.value.local_id) - Number(a.head.value.local_id) || b.shard - a.shard)
        const chosen = active[0]
        const row = chosen.head.value
        const sender = chosen.senders.get(Number(row.real_sender_id)) ?? ''
        page.push({
          mesLocalID: `${chosen.shard}:${row.local_id}`, serverId: String(row.server_id ?? ''),
          messageType: row.local_type, msgCreateTime: row.create_time,
          msgContent: typeof row.message_content === 'string' ? row.message_content : '',
          mesDes: sender === this.ownUsername ? 0 : 1, sender
        })
        chosen.head = chosen.iterator.next()
        if (page.length >= pageSize) { yield page; page = [] }
      }
      if (page.length) yield page
    } finally { for (const cursor of cursors) cursor.iterator.return?.() }
  }

  close() { this.db.close() }
}
