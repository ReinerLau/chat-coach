import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { createApi, isLocalRequest, registerWebRoutes } from '../src/http.js'

test('host API needs no coach token and generates without persisting a suggestion', async () => {
  let synced = 0
  let saved = 0
  const store = {
    sessions: () => [{ id: 'friend', name: '朋友' }],
    messages: () => [{ sessionId: 'friend', localId: '1', createdAt: 1, type: 1, isSelf: false, content: '你好' }],
    saveMessages: () => { saved++ }
  }
  const llm = { async *stream() { yield { type: 'text-delta', text: '{"reply":"你好！","reason":"自然回应"}' } } }
  const server = createServer(createApi({ store, sync: { sync: async () => { synced++ } }, llm, model: { provider: 'test', model: 'test' } }))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const base = `http://127.0.0.1:${server.address().port}/wechat-coach/api`
    const sessions = await fetch(`${base}/sessions`)
    assert.equal(sessions.status, 200)
    assert.equal((await sessions.json()).sessions[0].id, 'friend')
    const headers = { 'content-type': 'application/json', Origin: new URL(base).origin, 'sec-fetch-site': 'same-origin' }
    const suggestion = await fetch(`${base}/sessions/friend/suggest`, { method: 'POST', headers, body: '{}' })
    assert.equal(suggestion.status, 200)
    assert.equal((await suggestion.json()).reply, '你好！')
    assert.equal(synced, 1)
    assert.equal(saved, 0)
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)) }
})

test('local access accepts Pocket forwarding but rejects direct remote and cross-origin requests', () => {
  const request = (remoteAddress = '127.0.0.1', headers = {}) => ({ socket: { remoteAddress }, headers: { host: '127.0.0.1:3080', ...headers } })
  assert.equal(isLocalRequest(request()), true)
  assert.equal(isLocalRequest(request('::ffff:127.0.0.1', { origin: 'http://127.0.0.1:3080', 'sec-fetch-site': 'same-origin' })), true)
  assert.equal(isLocalRequest(request('::1', { host: '[::1]:3080', origin: 'http://[::1]:3080' })), true)
  assert.equal(isLocalRequest(request('192.168.0.45')), false)
  assert.equal(isLocalRequest(request('127.0.0.1', { host: '192.168.0.45:3080' })), false)
  assert.equal(isLocalRequest(request('127.0.0.1', { host: 'attacker.example:3080' })), false)
  assert.equal(isLocalRequest(request('127.0.0.1', { host: 'attacker.example@127.0.0.1:3080' })), false)
  assert.equal(isLocalRequest(request('127.0.0.1', { origin: 'https://attacker.example' })), false)
  assert.equal(isLocalRequest(request('127.0.0.1', { origin: 'null' })), false)
  assert.equal(isLocalRequest(request('127.0.0.1', { 'sec-fetch-site': 'cross-site' })), false)
})

test('host routes serve the coach page and protect API side effects', async () => {
  let synced = 0
  const routes = new Map()
  const webServer = { register(route) { routes.set(route.path, route); return () => routes.delete(route.path) } }
  const api = createApi({ store: { sessions: () => [{ id: 'friend' }] }, sync: { sync: async () => { synced++ } } })
  const dispose = registerWebRoutes(webServer, api)
  const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname
    const route = routes.get(path) ?? (path.startsWith('/wechat-coach/api/') ? routes.get('/wechat-coach/api') : null)
    if (route) return route.handler(req, res)
    res.writeHead(404); res.end()
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  try {
    const page = await fetch(`${base}/wechat-coach`)
    assert.equal(page.status, 200)
    assert.equal(page.headers.get('cache-control'), 'no-store')
    assert.match(await page.text(), /生成回复建议/)
    assert.equal((await fetch(`${base}/wechat-coach/setup`)).status, 404)
    assert.equal((await fetch(`${base}/wechat-coach`, { headers: { Origin: 'https://attacker.example' } })).status, 403)
    assert.equal((await fetch(`${base}/wechat-coach`, { method: 'POST' })).status, 405)
    const untrustedHostStatus = await new Promise((resolve, reject) => {
      const req = request(`${base}/wechat-coach/api/sessions`, { headers: { Host: 'attacker.example' } }, (res) => {
        res.resume(); res.on('end', () => resolve(res.statusCode))
      })
      req.on('error', reject); req.end()
    })
    assert.equal(untrustedHostStatus, 403)
    assert.equal((await fetch(`${base}/wechat-coach/api/sessions/friend/suggest`, { method: 'POST', headers: { Origin: 'https://attacker.example', 'content-type': 'application/json' }, body: '{}' })).status, 403)
    assert.equal((await fetch(`${base}/wechat-coach/api/sessions/friend/suggest`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: '{}' })).status, 415)
    assert.equal(synced, 0)
    dispose()
    assert.equal((await fetch(`${base}/wechat-coach`)).status, 404)
    assert.equal(routes.size, 0)
  } finally { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)) }
})

test('route registration rolls back if the coach page is already registered', () => {
  let disposed = false
  const webServer = { register(route) {
    if (route.path === '/wechat-coach') throw new Error('duplicate route')
    return () => { disposed = true }
  } }
  assert.throws(() => registerWebRoutes(webServer, () => {}), /duplicate route/)
  assert.equal(disposed, true)
})
