import { createHash } from 'node:crypto'
import { readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import { decompress } from 'fzstd'
import { SqliteWcdb } from './sqlite-wcdb.js'

function tableName(username) { return `Msg_${createHash('md5').update(username).digest('hex')}` }

function decodeMessageContent(value) {
  if (typeof value === 'string') return value
  if (!Buffer.isBuffer(value) && !(value instanceof Uint8Array)) return ''
  let data = Buffer.from(value)
  if (!data.length) return ''
  if (data.length >= 4 && data.readUInt32LE(0) === 0xfd2fb528) {
    try { data = Buffer.from(decompress(data)) }
    catch { return '' }
  }
  const decoded = data.toString('utf8')
  const replacementCount = (decoded.match(/\uFFFD/g) || []).length
  if (replacementCount >= decoded.length * 0.2) return ''
  const readableCount = Array.from(decoded).filter((char) => {
    const code = char.codePointAt(0)
    return code === 0x09 || code === 0x0a || code === 0x0d || code >= 0x20
  }).length
  return decoded && readableCount / Array.from(decoded).length > 0.85
    ? decoded.replace(/\uFFFD/g, '')
    : ''
}

function quoteIdentifier(value) { return `"${String(value).replaceAll('"', '""')}"` }

export class WcdbSource {
  constructor({ libraryPath, accountRoot, key }) {
    this.db = new SqliteWcdb(libraryPath, key)
    this.root = join(accountRoot, 'db_storage')
    this.sessionDb = join(this.root, 'session/session.db')
    this.contactDb = join(this.root, 'contact/contact.db')
    this.ownUsername = basename(accountRoot).replace(/_[a-f0-9]{4}$/i, '')
    this.tableBySession = new Map()
    this.senderByDb = new Map()
    this.messageContentColumns = new Map()
  }

  refresh() {
    this.tableBySession.clear()
    this.senderByDb.clear()
    this.messageDbs = readdirSync(join(this.root, 'message')).filter((name) => /^message_\d+\.db$/.test(name)).map((name) => join(this.root, 'message', name))
    const sessionRows = this.db.query(this.sessionDb, 'SELECT username,last_timestamp FROM SessionTable')
    this.sessionTimes = new Map(sessionRows.map((row) => [row.username, Number(row.last_timestamp) || 0]))
    const candidates = new Set(sessionRows.map((row) => row.username))
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
      return { username, nickname: contact?.remark || contact?.nick_name || contact?.alias || username,
        updatedAt: this.sessionTimes.get(username) ?? 0 }
    })
  }

  messagePage(sessionId, limit, before = null) {
    const pages = this.messagePages(sessionId, limit, before, limit)
    try { return pages.next().value ?? [] }
    finally { pages.return() }
  }

  *messagePages(sessionId, pageSize, before = null, maxRows = Infinity) {
    if (before && (!Number.isSafeInteger(before.createdAt) || before.createdAt < 0 || !/^\d+:-?\d+$/.test(before.localId))) {
      throw new Error('分页游标无效')
    }
    const paths = this.tableBySession.get(sessionId) ?? []
    const table = tableName(sessionId)
    const cursors = []
    try {
      for (const path of paths) {
        const shard = Number(basename(path).match(/\d+/)?.[0] ?? 0)
        const senders = this.senderByDb.get(path)
        const columns = this.getMessageContentColumns(path, table)
        const compressedContent = columns.compressed
          ? `, ${quoteIdentifier(columns.compressed)} AS compress_content`
          : ''
        // The cursor and shard contain only validated decimal characters before entering SQL.
        const where = before ? `WHERE create_time < ${before.createdAt} OR (create_time = ${before.createdAt} AND ('${shard}:' || CAST(local_id AS TEXT)) < '${before.localId}')` : ''
        const bound = Number.isFinite(maxRows) ? `LIMIT ${maxRows}` : ''
        const iterator = this.db.iterate(path, `SELECT local_id,server_id,local_type,real_sender_id,create_time,message_content${compressedContent} FROM "${table}" ${where} ORDER BY create_time DESC, CAST(local_id AS TEXT) DESC ${bound}`)
        const cursor = { iterator, head: null, shard, senders }
        cursors.push(cursor)
        cursor.head = iterator.next()
      }
      let page = []
      let seen = 0
      while (true) {
        const active = cursors.filter((cursor) => !cursor.head.done)
        if (!active.length) break
        active.sort((a, b) => {
          const time = Number(b.head.value.create_time) - Number(a.head.value.create_time)
          if (time) return time
          const aId = `${a.shard}:${a.head.value.local_id}`
          const bId = `${b.shard}:${b.head.value.local_id}`
          return aId < bId ? 1 : aId > bId ? -1 : 0
        })
        const chosen = active[0]
        const row = chosen.head.value
        const sender = chosen.senders.get(Number(row.real_sender_id)) ?? ''
        const msgContent = decodeMessageContent(row.compress_content) || decodeMessageContent(row.message_content)
        page.push({
          mesLocalID: `${chosen.shard}:${row.local_id}`, serverId: String(row.server_id ?? ''),
          messageType: row.local_type, msgCreateTime: row.create_time,
          msgContent,
          mesDes: sender === this.ownUsername ? 0 : 1, sender
        })
        chosen.head = chosen.iterator.next()
        if (page.length >= pageSize) { yield page; page = [] }
        if (++seen >= maxRows) break
      }
      if (page.length) yield page
    } finally { for (const cursor of cursors) cursor.iterator.return?.() }
  }

  getMessageContentColumns(path, table) {
    this.messageContentColumns ||= new Map()
    const key = `${path}:${table}`
    const cached = this.messageContentColumns.get(key)
    if (cached) return cached
    const names = new Map(this.db.query(path, `PRAGMA table_info(${quoteIdentifier(table)})`)
      .map((column) => [String(column.name).toLowerCase(), String(column.name)]))
    const compressed = ['compress_content', 'compresscontent', 'compressed_content', 'msg_compress_content', 'msgcompresscontent', 'wcdb_ct_compress_content', 'wcdb_ct_compresscontent']
      .map((name) => names.get(name))
      .find(Boolean)
    const columns = { compressed }
    this.messageContentColumns.set(key, columns)
    return columns
  }

  close() { this.db.close() }
}
