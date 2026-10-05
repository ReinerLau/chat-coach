import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createServer } from 'node:http'
import { createConnection } from 'node:net'
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'

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
if (args[1] === 'status') console.log(JSON.stringify({ process_running: state.running, healthy: state.running, ready: state.running, health_url: process.env.MOCK_HEALTH_URL }));
`, { mode: 0o700 })
  const env = { ...process.env, WECHAT_HISTORY_HOME: root, XDG_CONFIG_HOME: configRoot, TUNNEL_CLIENT_BIN: fake, MOCK_RUNTIME_FILE: runtimeFile, MOCK_HEALTH_URL: `http://127.0.0.1:${health.address().port}` }
  const cli = (args) => execute(bin, args, { env, timeout: 25000 })
  let manager
  let preconnect
  const readManager = async () => JSON.parse(await readFile(join(root, 'manager.json'), 'utf8'))
  const status = async () => (await fetch(`${manager.origin}/api/status`, { headers: { 'X-Wechat-Manager-Token': manager.token } })).json()
  const action = async (name) => {
    const response = await fetch(`${manager.origin}/api/${name}`, { method: 'POST', headers: { Origin: manager.origin, 'Content-Type': 'application/json', 'X-Wechat-Manager-Token': manager.token }, body: '{}' })
    assert.equal(response.status, 200)
    return response.json()
  }
  try {
    // A fresh installation still opens a usable manager and reports preparation errors.
    await assert.rejects(cli(['--no-open']), /README/)
    manager = await readManager()
    assert.equal((await status()).state, 'error')
    const key = join(scratch, 'mock-key')
    await writeFile(key, 'fake-runtime-key', { mode: 0o600 })
    await writeFile(join(configRoot, 'tunnel-client/wechat.yaml'), JSON.stringify({
      control_plane: { tunnel_id: `tunnel_${'a'.repeat(32)}`, api_key: `file:${key}` },
      mcp: { commands: [{ channel: 'main', command: 'node /mock/wechat-mcp --account-root /mock/account' }] }
    }))
    await Promise.all([cli(['--no-open']), cli(['--no-open'])])
    assert.equal((await readManager()).pid, manager.pid)
    assert.equal((await status()).state, 'running')
    assert.equal((await fetch(`${manager.origin}/`)).status, 200)
    assert.equal((await fetch(`${manager.origin}/style.css`)).status, 200)
    assert.deepEqual(JSON.parse(await readFile(runtimeFile, 'utf8')).calls, ['connect'])
    assert.equal((await action('stop')).state, 'stopped')
    assert.equal((await fetch(`${manager.origin}/`)).status, 200)
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
    await Promise.all([cli(['--no-open']), cli(['--no-open'])])
    manager = await readManager()
    assert.equal((await status()).state, 'running')
    await cli(['stop'])
  } finally {
    preconnect?.destroy()
    try { await cli(['stop']) } catch {}
    if (manager) { try { process.kill(manager.pid, 'SIGTERM') } catch {} }
    await new Promise((resolve) => health.close(resolve))
  }
}
