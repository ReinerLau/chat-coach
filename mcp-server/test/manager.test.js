import test from 'node:test'
import { request } from 'node:http'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { parse as parseShell } from 'shell-quote'
import { managerPaths, loadTunnelConfig, mcpCommand, validateRuntimeKey } from '../src/manager/config.js'
import { TunnelRuntime, safeLogs, localUrl } from '../src/manager/tunnel.js'
import { createManagerServer } from '../src/manager/server.js'
import { createStatusReporter } from '../src/status.js'
import { MessageStore } from '../src/store.js'
import { WechatSync } from '../src/sync.js'

async function fixture(t) {
  const home = await mkdtemp(join(tmpdir(), 'wechat-ui-'))
  t.after(() => rm(home, { recursive: true, force: true }))
  const paths = managerPaths(home, {})
  await mkdir(paths.profileDir, { recursive: true })
  await mkdir(paths.root, { recursive: true })
  const keyFile = join(home, 'runtime.key')
  await writeFile(keyFile, 'sk-secret-never-displayed')
  const profile = { control_plane: { tunnel_id: `tunnel_${'a'.repeat(32)}`, api_key: `file:${keyFile}` }, mcp: { commands: [{ channel: 'main', command: 'node "/package/bin/wechat-history-mcp.js" --account-root "/account with spaces"' }] }, log: { file: join(home, 'runtime.log') } }
  const save = async () => writeFile(paths.profileFile, JSON.stringify(profile))
  await save()
  const calls = []
  let running = false
  const runtime = new TunnelRuntime(paths, {
    home, env: { TUNNEL_CLIENT_BIN: process.execPath }, sleep: async () => {},
    run: async (_file, args) => {
      calls.push(args)
      if (args[1] === 'connect') running = true
      if (args[1] === 'stop') running = false
      return { stdout: args[1] === 'status' ? JSON.stringify({ process_running: running, healthy: running, ready: running, ui_url: 'http://127.0.0.1:1234/ui' }) : '' }
    }
  })
  runtime.mcpHealth = async () => running ? 'running' : 'stopped'
  return { home, paths, profile, save, runtime, calls }
}

test('loads existing JSON/YAML profile and creates a quoted installed MCP command with status reporting', async (t) => {
  const { paths, profile } = await fixture(t)
  const config = loadTunnelConfig(paths)
  assert.equal(config.accountRoot, '/account with spaces')
  assert.equal(config.statusFile, paths.statusFile)
  assert.match(mcpCommand(config), /--status-file/)
  assert.match(mcpCommand(config), /bin\/wechat-mcp\.js/)
  assert.equal(parseShell(mcpCommand(config))[2], 'stdio')
  assert.match(mcpCommand(config), /account with spaces/)
  await writeFile(paths.profileFile, `control_plane:\n  tunnel_id: ${profile.control_plane.tunnel_id}\n  api_key: '${profile.control_plane.api_key}'\nmcp:\n  commands:\n    - channel: main\n      command: 'node /package/wechat-history-mcp --account-root /account'\n`)
  assert.equal(loadTunnelConfig(paths).accountRoot, '/account')
})

test('accepts canonical stdio subcommand and legacy profiles while rejecting manager operations', async (t) => {
  const { paths, profile, save } = await fixture(t)
  for (const command of [
    'node /package/wechat-mcp.js stdio --account-root "/account with spaces"',
    'node /package/wechat-mcp.js --account-root "/account with spaces"',
    'node /package/wechat-history-mcp.js --account-root "/account with spaces"'
  ]) {
    profile.mcp.commands[0].command = command
    await save()
    assert.equal(loadTunnelConfig(paths).accountRoot, '/account with spaces')
    assert.equal(parseShell(mcpCommand(loadTunnelConfig(paths)))[2], 'stdio')
  }
  for (const args of ['', 'stop', '--background', 'stdio --background', 'stdio stop', 'stdio']) {
    profile.mcp.commands[0].command = `node /package/wechat-mcp.js ${args}`
    await save()
    assert.throws(() => loadTunnelConfig(paths), /wechat-mcp stdio/)
  }
})

test('retains an existing history profile and alias while upgrading its legacy MCP command', async (t) => {
  const { home, paths, profile, runtime, calls } = await fixture(t)
  assert.equal(paths.profileName, 'wechat')
  await writeFile(join(paths.profileDir, 'wechat-history.yaml'), JSON.stringify(profile))
  const legacy = managerPaths(home, {})
  assert.equal(legacy.profileName, 'wechat-history')
  assert.match(mcpCommand(loadTunnelConfig(legacy)), /bin\/wechat-mcp\.js/)
  runtime.paths = legacy
  await runtime.action('start')
  const connect = calls.find((args) => args[1] === 'connect')
  assert.equal(connect[connect.indexOf('--alias') + 1], 'wechat-history')
  assert.equal(connect[connect.indexOf('--profile') + 1], 'wechat-history')
})

test('rejects missing config, shell operations, other programs and raw keys without leaking values', async (t) => {
  const { paths, profile, save } = await fixture(t)
  for (const command of ['node /a/wechat-history-mcp --account-root /x; echo secret', 'node /a/other --account-root /x', 'node /a/wechat-history-mcp --account-root $SECRET']) {
    profile.mcp.commands[0].command = command
    await save()
    assert.throws(() => loadTunnelConfig(paths), (e) => !e.message.includes('secret') && /启动/.test(e.message))
  }
  profile.mcp.commands[0].command = 'node /a/wechat-history-mcp --account-root /x'
  profile.control_plane.api_key = 'sk-secret-never-displayed'
  await save()
  assert.throws(() => loadTunnelConfig(paths), /env: 或 file:/)
  await rm(paths.profileFile)
  assert.throws(() => loadTunnelConfig(paths), /README/)
})

test('missing runtime credentials and client give actionable errors', async (t) => {
  const { paths, runtime } = await fixture(t)
  assert.throws(() => validateRuntimeKey({ apiKey: 'env:MISSING' }, {}), /环境变量/)
  assert.throws(() => validateRuntimeKey({ apiKey: 'file:/missing' }), /密钥文件/)
  runtime.env.TUNNEL_CLIENT_BIN = '/missing-client'
  const status = await runtime.snapshot()
  assert.equal(status.state, 'error')
  assert.match(status.error, /安装/)
  assert.equal(status.mcp, 'unknown')
  assert.doesNotMatch(JSON.stringify(status), /sk-secret/)
})

test('idempotent start, sequential restart and concurrent operations never overlap', async (t) => {
  const { runtime, calls } = await fixture(t)
  await runtime.action('start')
  await runtime.action('start')
  assert.equal(calls.filter((args) => args[1] === 'connect').length, 1)
  calls.length = 0
  await Promise.all([runtime.action('restart'), runtime.action('stop'), runtime.action('start')])
  assert.deepEqual(calls.filter((args) => ['connect', 'stop'].includes(args[1])).map((args) => args[1]), ['stop', 'connect', 'stop', 'connect'])
  assert.equal((await runtime.snapshot()).state, 'running')
  const connect = calls.find((args) => args[1] === 'connect')
  assert.ok(connect.includes('--profile-dir'))
  assert.match(connect.at(-1), /--status-file/)
})

test('restart refuses to connect until the old instance is stopped', async (t) => {
  const { runtime } = await fixture(t)
  let connected = false
  runtime.run = async (_file, args) => {
    if (args[1] === 'connect') connected = true
    return { stdout: args[1] === 'status' ? JSON.stringify({ process_running: true, healthy: true, ready: true }) : '' }
  }
  await assert.rejects(runtime.action('restart'), /旧服务尚未停止/)
  assert.equal(connected, false)
})

test('an initialized profile can start before its official managed alias exists', async (t) => {
  const { runtime } = await fixture(t)
  const original = runtime.run
  let known = false
  runtime.run = async (file, args) => {
    if (args[1] === 'connect') known = true
    if (!known && ['status', 'stop'].includes(args[1])) throw Object.assign(new Error('unknown alias'), { stderr: 'alias wechat is not known; run create or connect first\n' })
    return original(file, args)
  }
  assert.equal((await runtime.snapshot()).state, 'stopped')
  assert.equal((await runtime.action('stop')).state, 'stopped')
  assert.equal((await runtime.action('start')).state, 'running')
})

test('timeouts and failed startup report errors and later actions recover', async (t) => {
  const { runtime } = await fixture(t)
  const original = runtime.run
  runtime.run = async () => { throw Object.assign(new Error('sk-secret private body'), { killed: true }) }
  await assert.rejects(runtime.action('start'), /超时/)
  assert.doesNotMatch(JSON.stringify(await runtime.snapshot()), /sk-secret|private body/)
  runtime.run = original
  assert.equal((await runtime.action('start')).state, 'running')
  await runtime.action('stop')
  runtime.run = async (_file, args) => ({ stdout: args[1] === 'status' ? JSON.stringify({ process_running: false, healthy: false, ready: false }) : '' })
  await assert.rejects(runtime.action('start'), /未就绪/)
})

test('HTTP health must confirm the MCP child, and diagnostic URLs never accept external hosts', async (t) => {
  const { runtime } = await fixture(t)
  assert.equal(localUrl('https://example.com'), null)
  assert.equal(localUrl('http://user:secret@127.0.0.1:1234'), null)
  assert.equal(localUrl('http://127.0.0.1:1234/ui'), 'http://127.0.0.1:1234')
  const healthServer = await createManagerServer({ snapshot: async () => ({}), action: async () => ({}) })
  t.after(() => new Promise((resolve) => healthServer.server.close(resolve)))
  // Unknown health endpoints cannot be mistaken for a running MCP child.
  assert.equal(await TunnelRuntime.prototype.mcpHealth.call(runtime, { process_running: true, health_url: healthServer.origin }), 'unknown')
  assert.equal(await TunnelRuntime.prototype.mcpHealth.call(runtime, { process_running: false }), 'stopped')
})

test('sync snapshots mark dead and previous-run reports stale and preserve counts only', async (t) => {
  const { paths, runtime } = await fixture(t)
  await writeFile(paths.statusFile, JSON.stringify({ pid: process.pid, startedAt: '2026-01-01T00:00:00Z', phase: 'idle', sessions: 4, messages: 12, lastSuccessAt: '2026-01-01T00:00:01Z', secret: 'sk-secret', content: 'private body' }))
  const current = await runtime.syncState(true, '2026-01-01T00:00:00Z')
  assert.equal(current.phase, 'idle')
  assert.equal(current.messages, 12)
  assert.doesNotMatch(JSON.stringify(current), /sk-secret|private body/)
  assert.equal((await runtime.syncState(true, '2026-02-01T00:00:00Z')).stale, true)
  runtime.isAlive = () => false
  assert.equal((await runtime.syncState(true)).phase, 'unavailable')
  assert.equal((await runtime.syncState(false)).phase, 'stopped')
})

test('diagnostic logs retain only allowed event text and cap the result at 100', async (t) => {
  const { profile } = await fixture(t)
  const logs = Array.from({ length: 110 }, () => JSON.stringify({ time: new Date().toISOString(), level: 'INFO', msg: 'dispatcher forwarded command to MCP server', payload: 'private chat', api_key: 'sk-secret' }))
  logs.push(JSON.stringify({ level: 'ERROR', msg: 'sk-secret private body' }), '[wechat-history-mcp] sk-secret private body')
  await writeFile(profile.log.file, logs.join('\n'))
  const safe = await safeLogs(profile.log.file)
  assert.equal(safe.length, 100)
  assert.doesNotMatch(JSON.stringify(safe), /sk-secret|private body|private chat/)
})

test('manager serves a shared favicon and brand icon with static asset security headers', async (t) => {
  const manager = await createManagerServer({})
  t.after(() => new Promise((resolve) => manager.server.close(resolve)))
  const html = await (await fetch(`${manager.origin}/`)).text()
  assert.match(html, /<link rel="icon" type="image\/svg\+xml" sizes="any" href="\/icon.svg">/)
  assert.match(html, /<img class="mark" src="\/icon.svg" width="44" height="44" alt="">/)
  const icon = await fetch(`${manager.origin}/icon.svg`)
  assert.equal(icon.status, 200)
  assert.equal(icon.headers.get('content-type'), 'image/svg+xml')
  assert.equal(icon.headers.get('cache-control'), 'no-store')
  assert.equal(icon.headers.get('x-content-type-options'), 'nosniff')
  assert.match(icon.headers.get('content-security-policy'), /img-src 'self' data:/)
  assert.equal(await icon.text(), await readFile(new URL('../web/icon.svg', import.meta.url), 'utf8'))
  assert.equal(await new Promise((resolve, reject) => {
    const req = request(`${manager.origin}/icon.svg`, { headers: { Host: 'evil.example' } }, (res) => { res.resume(); resolve(res.statusCode) })
    req.on('error', reject); req.end()
  }), 403)
})

test('manager HTTP serves packed assets, rejects cross-site and arbitrary commands, survives service stop', async (t) => {
  const { runtime } = await fixture(t)
  let shutDown = false
  const manager = await createManagerServer(runtime, { onShutdown: () => { shutDown = true } })
  t.after(() => new Promise((resolve) => manager.server.close(resolve)))
  const headers = { Origin: manager.origin, 'Content-Type': 'application/json', 'X-Wechat-Manager-Token': manager.token }
  const get = (path, extra = {}) => fetch(`${manager.origin}${path}`, { headers: { 'X-Wechat-Manager-Token': manager.token, ...extra } })
  const post = (path, extra = {}, body = '{}') => fetch(`${manager.origin}${path}`, { method: 'POST', headers: { ...headers, ...extra }, body })
  assert.match(await (await get('/')).text(), /微信历史/)
  assert.match(await (await get('/app.js')).text(), /setInterval\(refresh, 2000\)/)
  assert.equal((await fetch(`${manager.origin}/api/status`)).status, 403)
  assert.equal(await new Promise((resolve, reject) => {
    const req = request(`${manager.origin}/api/status`, { headers: { Host: 'evil.example', 'X-Wechat-Manager-Token': manager.token } }, (res) => { res.resume(); resolve(res.statusCode) })
    req.on('error', reject); req.end()
  }), 403)
  assert.equal((await post('/api/start', { Origin: 'https://evil.example' })).status, 403)
  assert.equal((await post('/api/start', { 'X-Wechat-Manager-Token': 'a'.repeat(63) + 'é' })).status, 403)
  assert.equal((await post('/api/start', { 'Sec-Fetch-Site': 'cross-site' })).status, 403)
  assert.equal((await post('/api/start', {}, '{"command":"rm -rf /"}')).status, 400)
  assert.equal((await post('/api/execute')).status, 404)
  assert.equal((await post('/api/start', {}, 'x'.repeat(2048))).status, 413)
  assert.equal((await (await post('/api/start')).json()).state, 'running')
  assert.equal((await (await post('/api/stop')).json()).state, 'stopped')
  assert.equal((await get('/')).status, 200)
  assert.equal((await (await post('/api/restart')).json()).state, 'running')
  assert.equal((await post('/api/shutdown')).status, 200)
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(shutDown, true)
})

test('status reporting reflects synchronization, failure and recovery without writing message content', async (t) => {
  const { paths } = await fixture(t)
  const store = new MessageStore(':memory:')
  t.after(() => store.close())
  const reporter = createStatusReporter(paths.statusFile, store)
  let fail = false
  const sync = new WechatSync({ store, accountRoot: '/unused', onState: (state) => reporter.update(state), source: {
    sessions: () => { if (fail) throw new Error('sk-secret private body'); return [{ username: 'friend' }] },
    *messagePages() { yield [{ mesLocalID: 1, msgCreateTime: 1, msgContent: 'private body', mesDes: 1 }] }
  } })
  await sync.sync()
  let status = JSON.parse(await readFile(paths.statusFile, 'utf8'))
  assert.equal(status.phase, 'idle')
  assert.equal(status.sessions, 1)
  assert.equal(status.messages, 1)
  const lastSuccessAt = status.lastSuccessAt
  fail = true
  await assert.rejects(sync.sync())
  status = JSON.parse(await readFile(paths.statusFile, 'utf8'))
  assert.equal(status.phase, 'error')
  assert.equal(status.lastSuccessAt, lastSuccessAt)
  assert.doesNotMatch(JSON.stringify(status), /sk-secret|private body|friend/)
  fail = false
  await sync.sync()
  assert.equal(JSON.parse(await readFile(paths.statusFile, 'utf8')).error, null)
  sync.stop()
})
