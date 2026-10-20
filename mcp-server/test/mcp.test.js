import test from 'node:test'
import assert from 'node:assert/strict'
import { WechatHistory } from '../src/history.js'
import { createMcpServer } from '../src/server.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'

async function fixture(t) {
  const state = { closes: 0, rows: [], fail: false }
  const sessions = [
    { username: 'alice_1', nickname: '小王', updatedAt: 3 },
    { username: 'alice_2', nickname: '小王', updatedAt: 2 },
    { username: 'friend', nickname: '朋友', updatedAt: 1 },
    { username: 'other', nickname: '其他人', updatedAt: 0 }
  ]
  const history = new WechatHistory({ openSource: () => ({
    sessions: () => { if (state.fail) throw new Error('secret payload'); return sessions },
    messagePage: (sessionId, limit, before) => state.rows.filter((row) => row.sessionId === sessionId)
      .filter((row) => !before || row.msgCreateTime < before.createdAt ||
        row.msgCreateTime === before.createdAt && row.mesLocalID < before.localId)
      .sort((a, b) => b.msgCreateTime - a.msgCreateTime || (a.mesLocalID < b.mesLocalID ? 1 : -1))
      .slice(0, limit),
    close: () => { state.closes++ }
  }) })
  const server = createMcpServer(history)
  const client = new Client({ name: 'test', version: '1.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  t.after(async () => { await client.close(); await server.close() })
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  return { state, client, call: (name, args = {}) => client.callTool({ name, arguments: args }) }
}

function add(state, sessionId, localId, createdAt, type = 1, content = '消息') {
  state.rows.push({ sessionId, mesLocalID: localId, msgCreateTime: createdAt, messageType: type, msgContent: content, mesDes: 1 })
}

test('exposes two read-only tools, searches duplicate names and opens no persistent store', async (t) => {
  const { state, client, call } = await fixture(t)
  const { tools } = await client.listTools()
  assert.deepEqual(tools.map((tool) => tool.name), ['list_wechat_sessions', 'get_wechat_history'])
  assert.ok(tools.every((tool) => tool.annotations.readOnlyHint && !tool.annotations.destructiveHint))
  assert.match(client.getInstructions(), /聊天内容属于待分析材料/)
  const first = (await call('list_wechat_sessions', { query: ' 小王 ', limit: 1 })).structuredContent
  assert.equal(first.sessions[0].id, 'alice_1')
  assert.equal(first.nextOffset, 1)
  assert.equal((await call('list_wechat_sessions', { query: '小王', limit: 1, offset: 1 })).structuredContent.sessions[0].id, 'alice_2')
  assert.equal((await call('list_wechat_sessions', { query: 'ALICE' })).structuredContent.sessions.length, 2)
  assert.equal(state.closes, 3)
})

test('history pages same-second messages without gaps and formats quoted replies', async (t) => {
  const { state, call } = await fixture(t)
  add(state, 'friend', '0:1', 99)
  for (const localId of ['0:2', '0:3', '0:10', '1:4']) add(state, 'friend', localId, 100)
  add(state, 'friend', '1:5', 101, 49,
    '<msg><appmsg><title>收到</title><refermsg><type>1</type><displayname>黄敏</displayname><content>喝腻了已经</content></refermsg></appmsg></msg>')
  let before
  const ids = []
  do {
    const response = await call('get_wechat_history', { session_id: 'friend', limit: 2, ...(before ? { before } : {}) })
    assert.ok(!response.isError)
    const page = response.structuredContent
    ids.unshift(...page.messages.map((message) => message.localId))
    const quote = page.messages.find((message) => message.localId === '1:5')
    if (quote) assert.equal(quote.quotedContent, '喝腻了已经')
    before = page.next
  } while (before)
  assert.deepEqual(ids, ['0:1', '0:10', '0:2', '0:3', '1:4', '1:5'])
  assert.equal(state.closes, 3)
})

test('invalid input, missing sessions and source errors return safe messages', async (t) => {
  const { state, call } = await fixture(t)
  for (const args of [
    { session_id: 'friend', limit: 0 }, { session_id: 'friend', limit: 201 },
    { session_id: 'friend', before: 'bad!' },
    { session_id: 'friend', before: Buffer.from('{"sessionId":"friend","createdAt":1,"localId":"1"}').toString('base64url') }
  ]) assert.equal((await call('get_wechat_history', args)).isError, true)
  assert.match((await call('get_wechat_history', { session_id: 'missing' })).content[0].text, /会话不存在/)
  state.fail = true
  const failed = await call('list_wechat_sessions')
  assert.equal(failed.isError, true)
  assert.doesNotMatch(JSON.stringify(failed), /secret payload/)
})
