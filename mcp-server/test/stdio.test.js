import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { once } from 'node:events'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'

const entry = fileURLToPath(new URL('../bin/wechat-mcp.js', import.meta.url))

test('the published command starts the renamed CLI and identifies errors with the new name', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(manifest.name, '@reinerlau/wechat-mcp')
  assert.deepEqual(Object.keys(manifest.bin), ['wechat-mcp'])
  const command = fileURLToPath(new URL(`../${manifest.bin['wechat-mcp']}`, import.meta.url))
  const invalid = spawnSync(process.execPath, [command, '--unknown'], { encoding: 'utf8' })
  assert.equal(invalid.status, 2)
  assert.match(invalid.stderr, /wechat-mcp --account-root/)
  assert.doesNotMatch(invalid.stderr, /wechat-history-mcp/)
})

test('CLI help and invalid arguments work without a database or DSH', () => {
  const help = spawnSync(process.execPath, [entry, '--help'], { encoding: 'utf8' })
  assert.equal(help.status, 0)
  assert.match(help.stdout, /wechat-mcp --account-root/)
  const invalid = spawnSync(process.execPath, [entry, '--unknown'], { encoding: 'utf8' })
  assert.equal(invalid.status, 2)
  assert.equal(invalid.stdout, '')
  assert.match(invalid.stderr, /用法/)
})

for (const exitMethod of ['EOF', 'SIGTERM', 'SIGINT']) {
  test(`stdio initializes, discovers and calls tools, then releases resources on ${exitMethod}`, { timeout: 15000 }, async (t) => {
    const root = mkdtempSync(join(tmpdir(), 'mcp-stdio-'))
    mkdirSync(join(root, 'db_storage'))
    const child = spawn(process.execPath, [fileURLToPath(new URL('./fixtures/stdio.js', import.meta.url)), root], { stdio: 'pipe' })
    const exited = once(child, 'exit')
    let stderr = '', buffer = '', id = 0
    const pending = new Map()
    const packets = []
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk })
    child.stdout.setEncoding('utf8').on('data', (chunk) => {
      buffer += chunk
      let boundary
      while ((boundary = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 1)
        const packet = JSON.parse(line)
        packets.push(packet)
        pending.get(packet.id)?.(packet)
        pending.delete(packet.id)
      }
    })
    t.after(async () => {
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
      await exited
      rmSync(root, { recursive: true, force: true })
    })
    function request(method, params) {
      const current = ++id
      return new Promise((resolve) => {
        pending.set(current, resolve)
        child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: current, method, params }) + '\n')
      })
    }
    const initialized = await request('initialize', {
      protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1.0.0' }
    })
    assert.equal(initialized.result.serverInfo.name, 'wechat-mcp')
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n')
    const tools = await request('tools/list', {})
    assert.equal(tools.result.tools.length, 2)
    const sessions = await request('tools/call', { name: 'list_wechat_sessions', arguments: { query: '测试' } })
    assert.equal(sessions.result.structuredContent.sessions[0].id, 'friend')
    const history = await request('tools/call', { name: 'get_wechat_history', arguments: { session_id: 'friend' } })
    assert.equal(history.result.structuredContent.messages[0].content, '测试消息')
    if (exitMethod === 'EOF') child.stdin.end()
    else child.kill(exitMethod)
    const [code] = await exited
    assert.equal(code, exitMethod === 'SIGINT' ? 130 : 0, stderr)
    assert.equal(readFileSync(join(root, 'closed'), 'utf8'), 'yes')
    assert.equal(buffer, '')
    assert.ok(packets.every((packet) => packet.jsonrpc === '2.0'))
    assert.doesNotMatch(stderr, /测试消息|aaaaaaaaaaaaaaaa/)
  })
}
