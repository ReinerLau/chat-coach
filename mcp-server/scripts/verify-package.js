import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const scratch = mkdtempSync(join(tmpdir(), 'wechat-mcp-package-'))
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 60000 })
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout)
  return result.stdout
}
try {
  const [packed] = JSON.parse(run('npm', ['pack', '--json', '--pack-destination', scratch]))
  const files = new Set(packed.files.map((file) => file.path))
  for (const required of ['bin/wechat-mcp.js', 'src/server.js', 'native/keychain.c', 'vendor/weflow/libWCDB.dylib', 'vendor/weflow/LICENSE']) {
    assert.ok(files.has(required), `Missing package file: ${required}`)
  }
  assert.ok(!files.has('bin/wechat-history-mcp.js'))
  assert.ok(![...files].some((file) => /mobile\.html|src\/http\.js|src\/pairing\.js|src\/index\.js/.test(file)))
  const installed = join(scratch, 'installed')
  run('npm', ['install', '--prefix', installed, '--no-audit', '--no-fund', join(scratch, packed.filename)])
  const manifest = JSON.parse(readFileSync(join(installed, 'node_modules/@reinerlau/wechat-mcp/package.json')))
  assert.equal(manifest.name, '@reinerlau/wechat-mcp')
  assert.deepEqual(manifest.bin, { 'wechat-mcp': 'bin/wechat-mcp.js' })
  assert.equal(manifest.version, '0.1.0')
  assert.ok(!manifest.peerDependencies)
  assert.ok(!Object.keys(manifest.dependencies).some((name) => name.includes('deepseek') || name === 'qrcode'))
  const help = run(join(installed, 'node_modules/.bin/wechat-mcp'), ['--help'], scratch)
  assert.match(help, /wechat-mcp --account-root/)
  console.log('Package verified: standalone install, executable, WCDB library and license.')
} finally { rmSync(scratch, { recursive: true, force: true }) }
