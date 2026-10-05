import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { WcdbSource } from '../src/wcdb.js'
import { normalizeMessage } from '../src/normalize.js'

test('refresh discovers new message shards without restarting the source', () => {
  const root = mkdtempSync(join(tmpdir(), 'mcp-shards-'))
  mkdirSync(join(root, 'message'))
  writeFileSync(join(root, 'message/message_0.db'), '')
  const source = Object.create(WcdbSource.prototype)
  Object.assign(source, {
    root, sessionDb: join(root, 'session.db'), contactDb: join(root, 'contact.db'),
    tableBySession: new Map(), senderByDb: new Map(),
    db: { query: (_file, sql) => {
      if (sql.includes('SessionTable')) return [{ username: 'friend' }]
      if (sql.includes('contact')) return [{ username: 'friend', remark: '朋友' }]
      if (sql.includes('rowid,user_name')) return [{ rowid: 1, user_name: 'friend' }]
      if (sql.includes('Name2Id')) return [{ user_name: 'friend' }]
      if (sql.includes('sqlite_master')) return [{ name: `Msg_${createHash('md5').update('friend').digest('hex')}` }]
      throw new Error('unexpected query')
    } }
  })
  try {
    assert.equal(source.sessions()[0].nickname, '朋友')
    assert.equal(source.tableBySession.get('friend').length, 1)
    writeFileSync(join(root, 'message/message_1.db'), '')
    source.sessions()
    assert.equal(source.tableBySession.get('friend').length, 2)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

test('merged shards preserve sender identity, direction and unique local IDs', () => {
  const source = Object.create(WcdbSource.prototype)
  const paths = ['/message_0.db', '/message_1.db']
  Object.assign(source, {
    ownUsername: 'me', tableBySession: new Map([['group', paths]]),
    senderByDb: new Map(paths.map((path) => [path, new Map([[1, 'me'], [2, 'friend']])])),
    db: { *iterate(path) {
      yield { local_id: 1, server_id: 2, local_type: 1, real_sender_id: path === paths[0] ? 1 : 2, create_time: 100, message_content: 'hello' }
    } }
  })
  const rows = [...source.messagePages('group', 1)].flat().map((row) => normalizeMessage(row, 'group'))
  assert.deepEqual(rows.map((row) => row.localId), ['1:1', '0:1'])
  assert.deepEqual(rows.map((row) => row.isSelf), [false, true])
  assert.deepEqual(rows.map((row) => row.senderId), ['friend', 'me'])
})

test('partial cursor initialization failure finalizes all opened shard iterators', () => {
  const source = Object.create(WcdbSource.prototype)
  let finalized = 0
  const paths = ['/message_0.db', '/message_1.db']
  Object.assign(source, {
    tableBySession: new Map([['friend', paths]]), senderByDb: new Map(),
    db: { iterate(path) {
      return {
        next: () => { if (path === paths[1]) throw new Error('read failed'); return { done: false, value: {} } },
        return: () => { finalized++; return { done: true } }
      }
    } }
  })
  assert.throws(() => [...source.messagePages('friend', 200)], /read failed/)
  assert.equal(finalized, 2)
})
