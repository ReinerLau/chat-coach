import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { once } from 'node:events'
import { promisify } from 'node:util'
import { createServer } from 'node:http'
import { createConnection } from 'node:net'
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const execute = promisify(execFile)

// Exercise the real detached manager and CLI with a fake official client, never WeChat.
export async function verifyManager(bin, scratch) {
  const root = join(scratch, 'manager-home')
  const configRoot = join(scratch, 'config')
  await mkdir(join(configRoot, 'tunnel-client'), { recursive: true })
  await mkdir(root, { recursive: true })
  const fake = join(scratch, 'fake-tunnel-client')
  const runtimeFile = join(scratch, 'runtime.json')
  const health = createServer((_req, res) => {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ details: { child_state: 'running' } }))
  })
  await new Promise((resolve) => health.listen(0, '127.0.0.1', resolve))
  await writeFile(fake, `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
const file = process.env.MOCK_RUNTIME_FILE;
let state = { running: false, calls: [] };
if (!fs.existsSync(file) && ['status', 'stop'].includes(args[1])) {
  console.error('alias wechat is not known; run create or connect first'); process.exit(1);
}
try { state = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
if (args[1] === 'connect') { state.running = true; state.calls.push('connect'); }
if (args[1] === 'stop') { state.running = false; state.calls.push('stop'); }
fs.writeFileSync(file, JSON.stringify(state));
const pause = Number(args[1] === 'connect' ? process.env.MOCK_CONNECT_DELAY_MS : args[1] === 'stop' ? process.env.MOCK_STOP_DELAY_MS : 0);
if (pause > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, pause);
if (args[1] === 'status') console.log(JSON.stringify({ process_running: state.running, healthy: state.running, ready: state.running, health_url: process.env.MOCK_HEALTH_URL }));
`, { mode: 0o700 })
  const env = { ...process.env, WECHAT_HISTORY_HOME: root, XDG_CONFIG_HOME: configRoot, TUNNEL_CLIENT_BIN: fake, MOCK_RUNTIME_FILE: runtimeFile, MOCK_HEALTH_URL: `http://127.0.0.1:${health.address().port}` }
  const cli = (args) => execute(bin, args, { env, timeout: 25000 })
  let manager
  let preconnect
  const children = []
  const readManager = async () => JSON.parse(await readFile(join(root, 'manager.json'), 'utf8'))
  const status = async () => (await fetch(`${manager.origin}/api/status`, { headers: { 'X-Wechat-Manager-Token': manager.token } })).json()
  const preview = async (path) => {
    const response = await fetch(`${manager.origin}/api/preview/${path}`, { headers: { 'X-Wechat-Manager-Token': manager.token } })
    assert.equal(response.status, 200)
    return response.json()
  }
  const action = async (name) => {
    const response = await fetch(`${manager.origin}/api/${name}`, { method: 'POST', headers: { Origin: manager.origin, 'Content-Type': 'application/json', 'X-Wechat-Manager-Token': manager.token }, body: '{}' })
    assert.equal(response.status, 200)
    return response.json()
  }
  const waitFor = async (predicate) => {
    for (let i = 0; i < 500; i++) {
      if (await predicate()) return
      await new Promise((resolve) => setTimeout(resolve, 20))
    }
    assert.fail('Foreground lifecycle did not finish within 10 seconds')
  }
  const foreground = (extraEnv = {}) => {
    const child = spawn(bin, ['--no-open'], { env: { ...env, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] })
    children.push(child)
    const exited = once(child, 'exit')
    let stdout = '', stderr = ''
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk })
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk })
    return { child, exited, ready: () => waitFor(() => {
      assert.equal(child.exitCode, null, stderr)
      return stdout.includes('按 Ctrl+C')
    }) }
  }
  try {
    // A fresh installation still opens a usable manager and reports preparation errors.
    await assert.rejects(cli(['--no-open', '--background']), /README/)
    manager = await readManager()
    assert.equal((await status()).state, 'error')
    const key = join(scratch, 'mock-key')
    await writeFile(key, 'fake-runtime-key', { mode: 0o600 })
    const dataFile = join(scratch, 'preview cache.sqlite')
    const cache = new DatabaseSync(dataFile)
    try {
      cache.exec(`CREATE TABLE sessions(id TEXT PRIMARY KEY, name TEXT, updated_at INTEGER);
        CREATE TABLE messages(session_id TEXT, local_id TEXT, server_id TEXT, created_at INTEGER, type INTEGER, is_self INTEGER, content TEXT, sender_id TEXT);
        INSERT INTO sessions VALUES('friend', '模拟朋友', 2);
        INSERT INTO messages VALUES('friend', '1', '', 1, 1, 0, '模拟消息', 'friend');
        INSERT INTO messages VALUES('friend', '2', '', 2, 3, 1, 'private image metadata', '');`)
    } finally { cache.close() }
    await writeFile(join(configRoot, 'tunnel-client/wechat.yaml'), JSON.stringify({
      control_plane: { tunnel_id: `tunnel_${'a'.repeat(32)}`, api_key: `file:${key}` },
      mcp: { commands: [{ channel: 'main', command: `node /mock/wechat-mcp stdio --account-root /mock/account --data-file "${dataFile}"` }] }
    }))
    await Promise.all([cli(['--no-open', '--background']), cli(['--no-open', '--background'])])
    assert.equal((await readManager()).pid, manager.pid)
    assert.equal((await status()).state, 'running')
    assert.equal((await fetch(`${manager.origin}/`)).status, 200)
    assert.equal((await fetch(`${manager.origin}/style.css`)).status, 200)
    assert.match(await (await fetch(`${manager.origin}/`)).text(), /聊天数据预览/)
    assert.match(await (await fetch(`${manager.origin}/preview.js`)).text(), /preview\/history/)
    const sessions = await preview('sessions?query=模拟')
    assert.equal(sessions.sessions[0].id, 'friend')
    const history = await preview('history?session_id=friend&limit=1')
    assert.equal(history.messages[0].content, '[非文本消息：类型 3]')
    assert.equal(history.messages[0].isSelf, true)
    assert.equal((await preview(`history?session_id=friend&before=${history.next}`)).messages[0].content, '模拟消息')
    assert.deepEqual(JSON.parse(await readFile(runtimeFile, 'utf8')).calls, ['connect'])
    assert.equal((await action('stop')).state, 'stopped')
    assert.equal((await fetch(`${manager.origin}/`)).status, 200)
    assert.equal((await preview('history?session_id=friend')).messages.length, 2)
    await action('start')
    await action('restart')
    preconnect = createConnection({ host: '127.0.0.1', port: Number(new URL(manager.origin).port) })
    await new Promise((resolve, reject) => { preconnect.once('connect', resolve); preconnect.once('error', reject) })
    await cli(['stop'])
    assert.throws(() => process.kill(manager.pid, 0), { code: 'ESRCH' })
    for (let i = 0; i < 100; i++) {
      try { await access(join(root, 'manager.lock')); await new Promise((resolve) => setTimeout(resolve, 20)) }
      catch { break }
    }
    await assert.rejects(access(join(root, 'manager.lock')))
    await assert.rejects(access(join(root, 'manager.json')))
    assert.deepEqual(JSON.parse(await readFile(runtimeFile, 'utf8')).calls, ['connect', 'stop', 'connect', 'stop', 'connect', 'stop'])
    // Reclaim a dead daemon's lock and verify simultaneous first launches converge.
    await writeFile(join(root, 'manager.lock'), '2147483647')
    await Promise.all([cli(['--no-open', '--background']), cli(['--no-open', '--background'])])
    manager = await readManager()
    assert.equal((await status()).state, 'running')
    await cli(['stop'])

    // Default foreground can attach to an existing background instance.
    await cli(['--no-open', '--background'])
    manager = await readManager()
    const reusedPid = manager.pid
    const attached = foreground({ MOCK_STOP_DELAY_MS: '250' })
    await attached.ready()
    assert.equal((await readManager()).pid, reusedPid)
    await action('stop')
    assert.equal(attached.child.exitCode, null) // UI stop keeps the page and foreground alive.
    await action('start')
    attached.child.kill('SIGINT')
    await waitFor(async () => JSON.parse(await readFile(runtimeFile, 'utf8')).running === false)
    attached.child.kill('SIGINT')
    assert.deepEqual(await attached.exited, [130, null])
    assert.throws(() => process.kill(manager.pid, 0), { code: 'ESRCH' })
    await assert.rejects(access(join(root, 'manager.json')))

    // Interrupt after connect has begun but before it completes.
    const before = JSON.parse(await readFile(runtimeFile, 'utf8')).calls.length
    const starting = foreground({ MOCK_CONNECT_DELAY_MS: '500' })
    await waitFor(async () => {
      try { return JSON.parse(await readFile(runtimeFile, 'utf8')).calls.slice(before).includes('connect') }
      catch { return false }
    })
    manager = await readManager()
    starting.child.kill('SIGINT')
    assert.deepEqual(await starting.exited, [130, null])
    assert.throws(() => process.kill(manager.pid, 0), { code: 'ESRCH' })
    assert.equal(JSON.parse(await readFile(runtimeFile, 'utf8')).running, false)

    const terminating = foreground()
    await terminating.ready()
    manager = await readManager()
    terminating.child.kill('SIGTERM')
    assert.deepEqual(await terminating.exited, [143, null])
    assert.throws(() => process.kill(manager.pid, 0), { code: 'ESRCH' })

    const external = foreground()
    await external.ready()
    manager = await readManager()
    await cli(['stop'])
    assert.deepEqual(await external.exited, [0, null])
  } finally {
    preconnect?.destroy()
    try { await cli(['stop']) } catch {}
    if (manager) { try { process.kill(manager.pid, 'SIGTERM') } catch {} }
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    }
    await new Promise((resolve) => health.close(resolve))
  }
}
