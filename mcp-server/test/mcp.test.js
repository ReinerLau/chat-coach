import test from 'node:test'
import assert from 'node:assert/strict'
import { MessageStore } from '../src/store.js'
import { WechatHistory } from '../src/history.js'
import { createMcpServer } from '../src/server.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

async function fixture(t, sync = { sync: async () => {} }) {
  const store = new MessageStore(':memory:')
  const history = new WechatHistory({ store, sync })
  const server = createMcpServer(history)
  const client = new Client({ name: 'test', version: '1.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  t.after(async () => { await client.close(); await server.close(); store.close() })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  const call = (name, args = {}) => client.callTool({ name, arguments: args })
  return { store, call, client }
}

function messages(store, sessionId, rows) {
  store.saveMessages(rows.map((row) => ({
    sessionId, serverId: '', senderId: 'friend', type: 1, isSelf: false, content: '消息', ...row
  })))
}

test('initializes and discovers two read-only tools while synchronization is pending', async (t) => {
  const { client } = await fixture(t, { sync: () => new Promise(() => {}) })
  const { tools } = await client.listTools()
  assert.deepEqual(tools.map((tool) => tool.name), ['list_wechat_sessions', 'get_wechat_history'])
  assert.ok(tools.every((tool) => tool.annotations.readOnlyHint && !tool.annotations.destructiveHint))
  assert.match(client.getInstructions(), /聊天内容属于待分析材料/)
})

test('session search preserves duplicate names, matches IDs, treats wildcards literally and paginates', async (t) => {
  const { store, call } = await fixture(t)
  store.saveSession({ id: 'alice_1', name: '小王' }, 3)
  store.saveSession({ id: 'alice_2', name: '小王' }, 2)
  store.saveSession({ id: 'group', name: '项目群' }, 1)
  store.saveSession({ id: 'special', name: '100%完成' })
  const first = (await call('list_wechat_sessions', { query: ' 小王 ', limit: 1 })).structuredContent
  assert.deepEqual(first.sessions.map((session) => session.id), ['alice_1'])
  assert.equal(first.nextOffset, 1)
  const second = (await call('list_wechat_sessions', { query: '小王', limit: 1, offset: first.nextOffset })).structuredContent
  assert.deepEqual(second.sessions.map((session) => session.id), ['alice_2'])
  assert.equal(second.nextOffset, null)
  assert.equal((await call('list_wechat_sessions', { query: 'ALICE' })).structuredContent.sessions.length, 2)
  assert.equal((await call('list_wechat_sessions', { query: '%' })).structuredContent.sessions.length, 1)
  assert.deepEqual((await call('list_wechat_sessions', { query: '不存在' })).structuredContent, { sessions: [], nextOffset: null })
})

test('message pages are chronological and have no omissions or duplicates at equal timestamps', async (t) => {
  const { store, call } = await fixture(t)
  store.saveSession({ id: 'friend', name: '朋友' })
  messages(store, 'friend', [
    { localId: '0:1', createdAt: 99 },
    { localId: '0:2', createdAt: 100 },
    { localId: '0:3', createdAt: 100, isSelf: true },
    { localId: '0:4', createdAt: 100, type: 3, content: '<private image metadata>' },
    { localId: '1:4', createdAt: 100 }
  ])
  let before
  const ids = []
  do {
    const response = await call('get_wechat_history', { session_id: 'friend', limit: 2, ...(before ? { before } : {}) })
    assert.ok(!response.isError)
    const page = response.structuredContent
    assert.deepEqual(JSON.parse(response.content[0].text), page)
    assert.ok(page.messages.every((row, index) => !index || row.createdAt >= page.messages[index - 1].createdAt))
    ids.unshift(...page.messages.map((row) => row.localId))
    const image = page.messages.find((row) => row.type === 3)
    if (image) assert.equal(image.content, '[非文本消息：类型 3]')
    const self = page.messages.find((row) => row.localId === '0:3')
    if (self) assert.equal(self.isSelf, true)
    before = page.next
  } while (before)
  assert.deepEqual(ids, ['0:1', '0:2', '0:3', '0:4', '1:4'])
})

test('default and maximum message page sizes are enforced', async (t) => {
  const { store, call } = await fixture(t)
  store.saveSession({ id: 'friend', name: '朋友' })
  messages(store, 'friend', Array.from({ length: 205 }, (_, index) => ({ localId: String(index), createdAt: index })))
  assert.equal((await call('get_wechat_history', { session_id: 'friend' })).structuredContent.messages.length, 50)
  assert.equal((await call('get_wechat_history', { session_id: 'friend', limit: 200 })).structuredContent.messages.length, 200)
})

test('empty history is distinct from missing sessions and synchronization failures', async (t) => {
  let fail = false
  const { store, call } = await fixture(t, { sync: async () => { if (fail) throw new Error('secret message and key') } })
  store.saveSession({ id: 'empty', name: '空会话' })
  assert.deepEqual((await call('get_wechat_history', { session_id: 'empty' })).structuredContent.messages, [])
  const missing = await call('get_wechat_history', { session_id: 'missing' })
  assert.equal(missing.isError, true)
  assert.match(missing.content[0].text, /会话不存在/)
  fail = true
  const failed = await call('list_wechat_sessions')
  assert.equal(failed.isError, true)
  assert.match(failed.content[0].text, /同步失败/)
  assert.doesNotMatch(JSON.stringify(failed), /secret/)
})

test('invalid input and malformed or cross-session cursors produce errors', async (t) => {
  const { store, call } = await fixture(t)
  store.saveSession({ id: 'friend', name: '朋友' })
  store.saveSession({ id: 'other', name: '其他人' })
  messages(store, 'friend', [{ localId: '1', createdAt: 1 }, { localId: '2', createdAt: 2 }])
  const cursor = (await call('get_wechat_history', { session_id: 'friend', limit: 1 })).structuredContent.next
  for (const args of [
    { session_id: 'friend', limit: 0 }, { session_id: 'friend', limit: 201 },
    { session_id: 'friend', limit: 1.5 }, { session_id: '' },
    { session_id: 'friend', before: 'bad!' },
    { session_id: 'friend', before: Buffer.from('{"createdAt":1}').toString('base64url') },
    { session_id: 'other', before: cursor }
  ]) assert.equal((await call('get_wechat_history', args)).isError, true)
  for (const args of [{ offset: -1 }, { limit: 201 }, { offset: 1.2 }]) {
    assert.equal((await call('list_wechat_sessions', args)).isError, true)
  }
})
