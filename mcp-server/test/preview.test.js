import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { request } from 'node:http'
import { DatabaseSync } from 'node:sqlite'
import { MessageStore } from '../src/store.js'
import { CachePreview, PreviewError } from '../src/manager/preview.js'
import { createManagerServer } from '../src/manager/server.js'

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'wechat-preview-'))
  const dataFile = join(root, 'custom cache.sqlite')
  const profileFile = join(root, 'profile.yaml')
  const profile = {
    control_plane: { tunnel_id: `tunnel_${'a'.repeat(32)}`, api_key: 'env:MISSING_TEST_KEY' },
    mcp: { commands: [{ channel: 'main', command: `node /mock/wechat-mcp stdio --account-root /mock/account --data-file "${dataFile}"` }] }
  }
  const writeProfile = () => writeFile(profileFile, JSON.stringify(profile))
  await writeProfile()
  const store = new MessageStore(dataFile)
  // No tunnel client or runtime credentials: preview only needs the configured cache.
  const preview = new CachePreview({ profileFile }, { env: {} })
  t.after(async () => { store.close(); await rm(root, { recursive: true, force: true }) })
  const read = (kind, params = {}) => preview.read(kind, new URLSearchParams(params))
  return { root, dataFile, profileFile, profile, writeProfile, store, preview, read }
}

function seed(store, sessionId, count = 5) {
  store.saveSession({ id: sessionId, name: sessionId === 'friend' ? '小王' : '其他人' }, count)
  store.saveMessages(Array.from({ length: count }, (_, index) => ({
    sessionId, localId: String(index).padStart(3, '0'), serverId: '',
    createdAt: 100, type: index === count - 1 ? 3 : 1, isSelf: index % 2 === 0,
    content: index === count - 1 ? 'private image metadata' : `消息${index}`,
    senderId: sessionId
  })))
}

function rejectsRead(fn, status, pattern) {
  assert.throws(fn, (error) => error instanceof PreviewError && error.status === status && (!pattern || pattern.test(error.message)))
}

test('cache preview searches and paginates configured sessions without synchronizing', async (t) => {
  const { store, read } = await fixture(t)
  seed(store, 'friend')
  store.saveSession({ id: 'friend-two', name: '小王' }, 4)
  for (let i = 0; i < 205; i++) store.saveSession({ id: `other-${i}`, name: '其他人' })
  const first = read('sessions', { query: ' 小王 ', limit: '1' })
  assert.equal(first.sessions[0].id, 'friend')
  assert.equal(first.nextOffset, 1)
  assert.equal(read('sessions', { query: '小王', limit: '1', offset: '1' }).sessions[0].id, 'friend-two')
  assert.equal(read('sessions', { query: 'FRIEND' }).sessions.length, 2)
  assert.equal(read('sessions').sessions.length, 50)
  assert.equal(read('sessions', { limit: '200' }).sessions.length, 200)
  assert.deepEqual(read('sessions', { query: 'missing' }), { sessions: [], nextOffset: null })
})

test('cache history pages same-second messages, masks non-text and distinguishes empty and missing sessions', async (t) => {
  const { store, read } = await fixture(t)
  seed(store, 'friend', 105)
  seed(store, 'other', 1)
  store.saveSession({ id: 'empty', name: '空会话' })
  const latest = read('history', { session_id: 'friend' })
  assert.equal(latest.messages.length, 50)
  assert.equal(latest.messages.at(-1).content, '[非文本消息：类型 3]')
  assert.equal(latest.messages.at(-1).isSelf, true)
  let before, ids = []
  do {
    const page = read('history', { session_id: 'friend', limit: '2', ...(before ? { before } : {}) })
    ids.unshift(...page.messages.map((message) => message.localId))
    before = page.next
  } while (before)
  assert.deepEqual(ids, Array.from({ length: 105 }, (_, i) => String(i).padStart(3, '0')))
  assert.deepEqual(read('history', { session_id: 'empty' }).messages, [])
  rejectsRead(() => read('history', { session_id: 'missing' }), 404, /会话不存在/)
  rejectsRead(() => read('history', { session_id: 'friend', before: 'bad!' }), 400, /游标/)
  rejectsRead(() => read('history', { session_id: 'other', before: latest.next }), 400, /游标/)
})

test('preview rejects malformed, repeated, unknown and file-selection parameters', async (t) => {
  const { read, preview } = await fixture(t)
  for (const params of [
    { limit: '0' }, { limit: '201' }, { limit: '1.5' }, { limit: '' },
    { offset: '-1' }, { offset: '9007199254740992' },
    { query: 'a'.repeat(201) }, { path: '/private/file' }, { 'data-file': '/other/cache' }
  ]) rejectsRead(() => read('sessions', params), 400)
  for (const params of ['limit=1&limit=2', '__proto__=x', 'constructor=x', 'prototype=x']) {
    rejectsRead(() => preview.read('sessions', new URLSearchParams(params)), 400)
  }
  for (const params of [{}, { session_id: '' }, { session_id: 'a'.repeat(501) }, { session_id: 'friend', before: '' }]) {
    rejectsRead(() => read('history', params), 400)
  }
})

test('read-only stores neither create missing caches nor migrate existing databases', async (t) => {
  const { root } = await fixture(t)
  const missing = join(root, 'missing', 'cache.sqlite')
  assert.throws(() => new MessageStore(missing, { readOnly: true }))
  await assert.rejects(access(join(root, 'missing')), { code: 'ENOENT' })
  const legacy = join(root, 'legacy.sqlite')
  const db = new DatabaseSync(legacy)
  db.exec("CREATE TABLE sessions(id TEXT PRIMARY KEY,name TEXT,updated_at INTEGER); INSERT INTO sessions VALUES('old','旧缓存',1)")
  db.close()
  const original = await readFile(legacy)
  const store = new MessageStore(legacy, { readOnly: true })
  try {
    assert.equal(store.sessions()[0].id, 'old')
    assert.equal(store.db.prepare('PRAGMA table_info(sessions)').all().length, 3)
    assert.equal(store.db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE name='messages'").get().n, 0)
    assert.throws(() => store.db.exec("UPDATE sessions SET name='changed'"), /readonly|read-only/i)
  } finally { store.close() }
  assert.deepEqual(await readFile(legacy), original)
})

test('preview sees committed WAL data during a writer transaction and subsequent updates', async (t) => {
  const { store, read } = await fixture(t)
  seed(store, 'friend', 1)
  store.db.prepare('UPDATE messages SET type=1,content=? WHERE session_id=?').run('已提交', 'friend')
  store.db.exec('BEGIN IMMEDIATE')
  try {
    store.db.prepare('UPDATE messages SET content=? WHERE session_id=?').run('未提交', 'friend')
    assert.equal(read('history', { session_id: 'friend' }).messages[0].content, '已提交')
  } finally { store.db.exec('ROLLBACK') }
  store.saveMessages([{ sessionId: 'friend', localId: 'new', serverId: '', createdAt: 101, type: 1, isSelf: false, senderId: 'friend', content: '新消息' }])
  assert.equal(read('history', { session_id: 'friend' }).messages.at(-1).content, '新消息')
})

test('missing config, unavailable cache and corrupt database produce safe recoverable errors', async (t) => {
  const { root, read, profile, writeProfile, profileFile } = await fixture(t)
  profile.mcp.commands[0].command = `node /mock/wechat-mcp stdio --account-root /mock/account --data-file "${join(root, 'absent.sqlite')}"`
  await writeProfile()
  rejectsRead(() => read('sessions'), 503, /缓存数据库不可用/)
  await assert.rejects(access(join(root, 'absent.sqlite')), { code: 'ENOENT' })
  await writeFile(join(root, 'absent.sqlite'), 'private error content')
  rejectsRead(() => read('sessions'), 503, /无法读取缓存/)
  await rm(profileFile)
  rejectsRead(() => read('sessions'), 503, /隧道配置/)
  await writeFile(profileFile, 'private invalid config')
  rejectsRead(() => read('sessions'), 503, /隧道 ID 无效/)
})

test('HTTP preview enforces local authentication, keeps bodies uncached and survives service stop', async (t) => {
  const { preview, store } = await fixture(t)
  seed(store, 'friend')
  const controller = { snapshot: async () => ({ state: 'stopped' }), action: async () => ({ state: 'stopped' }) }
  const manager = await createManagerServer(controller, { preview })
  t.after(() => new Promise((resolve) => { manager.server.close(resolve); manager.server.closeAllConnections() }))
  const headers = { 'X-Wechat-Manager-Token': manager.token }
  const get = (path, extra = {}) => fetch(`${manager.origin}${path}`, { headers: { ...headers, ...extra } })
  const path = '/api/preview/history?session_id=friend'
  const response = await get(path)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal((await response.json()).messages.length, 5)
  for (const extra of [{ 'X-Wechat-Manager-Token': '' }, { 'X-Wechat-Manager-Token': 'wrong' }, { Origin: 'https://evil.example' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    assert.equal((await get(path, extra)).status, 403)
  }
  assert.equal(await new Promise((resolve, reject) => {
    const req = request(`${manager.origin}${path}`, { headers: { ...headers, Host: 'evil.example' } }, (res) => { res.resume(); resolve(res.statusCode) })
    req.on('error', reject); req.end()
  }), 403)
  assert.equal((await get('/api/preview/sessions?limit=201')).status, 400)
  assert.equal((await get('/api/preview/history?session_id=missing')).status, 404)
  assert.equal((await get('/api/preview/history?session_id=friend&before=bad!')).status, 400)
  const stopped = await fetch(`${manager.origin}/api/stop`, { method: 'POST', headers: { ...headers, Origin: manager.origin, 'Content-Type': 'application/json' }, body: '{}' })
  assert.equal(stopped.status, 200)
  assert.equal((await get(path)).status, 200)
  assert.match(await (await get('/preview.js')).text(), /preview\/history/)
})
