import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createApi } from '../src/http.js'

test('phone API requires token and generates without persisting a suggestion', async () => {
  let synced = 0
  let saved = 0
  const store = {
    sessions: () => [{ id: 'friend', name: '朋友' }],
    messages: () => [{ sessionId: 'friend', localId: '1', createdAt: 1, type: 1, isSelf: false, content: '你好' }],
    saveMessages: () => { saved++ }
  }
  const llm = { async *stream() { yield { type: 'text-delta', text: '{"reply":"你好！","reason":"自然回应"}' } } }
  const server = createServer(createApi({ store, sync: { sync: async () => { synced++ } }, llm, token: 'a'.repeat(24), model: { provider: 'test', model: 'test' } }))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const base = `http://127.0.0.1:${server.address().port}/wechat-coach/api`
    const unauthorized = await fetch(`${base}/sessions`)
    assert.equal(unauthorized.status, 401)
    const headers = { Authorization: `Bearer ${'a'.repeat(24)}` }
    const sessions = await fetch(`${base}/sessions`, { headers })
    assert.equal(sessions.status, 200)
    const suggestion = await fetch(`${base}/sessions/friend/suggest`, { method: 'POST', headers, body: '{}' })
    assert.equal(suggestion.status, 200)
    assert.equal((await suggestion.json()).reply, '你好！')
    assert.equal(synced, 1)
    assert.equal(saved, 0)
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)) }
})
