import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { setImmediate } from 'node:timers/promises'
import { createHistoryRuntime } from '../src/runtime.js'
import { MessageStore } from '../src/store.js'
import { WechatSync } from '../src/sync.js'
import { parseConfig, defaultDataFile } from '../src/config.js'

test('CLI configuration isolates caches by account and accepts explicit data files', () => {
  const first = defaultDataFile('/wechat/one', '/tmp/coach-home')
  assert.match(first, /\.wechat-history-mcp\/accounts\/[a-f0-9]{64}\/messages.sqlite$/)
  assert.notEqual(first, defaultDataFile('/wechat/two', '/tmp/coach-home'))
  assert.equal(first, defaultDataFile('/wechat/one/', '/tmp/coach-home'))
  assert.equal(parseConfig(['--account-root', '/wechat/one', '--data-file', '/tmp/cache.sqlite']).dataFile, '/tmp/cache.sqlite')
  assert.equal(parseConfig(['--account-root', '/a', '--status-file', '/tmp/status.json']).statusFile, '/tmp/status.json')
  assert.equal(parseConfig(['--help']).help, true)
  for (const args of [[], ['--account-root', ''], ['--account-root', '/a', '--data-file', ''], ['--account-root', '/a', '--status-file', ''], ['--wrong'], ['positional']]) {
    assert.throws(() => parseConfig(args))
  }
})

test('uses the existing key reader, starts synchronization and closes resources only once', async () => {
  const calls = []
  let finish
  const inFlight = new Promise((resolve) => { finish = resolve })
  const runtime = createHistoryRuntime({ accountRoot: '/account', dataFile: '/cache' }, {
    env: {}, keyReader: (root) => { assert.equal(root, '/account'); return 'a'.repeat(64) },
    sourceFactory: ({ key }) => { assert.equal(key, 'a'.repeat(64)); return { close: () => calls.push('source') } },
    storeFactory: () => ({ close: () => calls.push('store') }),
    syncFactory: () => ({ inFlight, start: () => calls.push('start'), stop: () => calls.push('stop') })
  })
  runtime.start()
  const closing = runtime.close()
  assert.equal(runtime.close(), closing)
  assert.deepEqual(calls, ['start', 'stop'])
  finish()
  await closing
  assert.deepEqual(calls, ['start', 'stop', 'source', 'store'])
})

test('environment keys bypass keychain and failed initialization releases resources without leaking secrets', () => {
  let closed = false
  assert.throws(() => createHistoryRuntime({ accountRoot: '/account' }, {
    env: { WECHAT_DB_KEY: 'b'.repeat(64) },
    keyReader: () => { throw new Error('should not read keychain') },
    sourceFactory: () => ({ close: () => { closed = true } }),
    storeFactory: () => { throw new Error('secret payload') }
  }), (error) => { assert.doesNotMatch(error.message, /secret/); return true })
  assert.equal(closed, true)
  assert.throws(() => createHistoryRuntime({}, { env: { WECHAT_DB_KEY: 'invalid' }, keyReader: () => null }), /有效微信数据库密钥/)
})

test('cache still closes when source cleanup fails', async () => {
  let closed = false
  const runtime = createHistoryRuntime({}, {
    env: { WECHAT_DB_KEY: 'a'.repeat(64) },
    sourceFactory: () => ({ close: () => { throw new Error('close failed') } }),
    storeFactory: () => ({ close: () => { closed = true } }),
    syncFactory: () => ({ stop() {} })
  })
  await assert.rejects(runtime.close(), /close failed/)
  assert.equal(closed, true)
})

test('first import yields between pages; stopping waits for the active import before closing the database', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'mcp-runtime-'))
  mkdirSync(join(dir, 'db_storage'))
  let sourceClosed = false
  let store
  const source = {
    sessions: () => [{ username: 'friend' }],
    *messagePages() {
      for (let id = 500; id > 0; id--) yield [{ mesLocalID: id, msgCreateTime: id, msgContent: String(id), mesDes: 1 }]
    },
    close: () => { sourceClosed = true }
  }
  const runtime = createHistoryRuntime({ accountRoot: dir, dataFile: join(dir, 'cache.sqlite') }, {
    env: { WECHAT_DB_KEY: 'a'.repeat(64) }, sourceFactory: () => source,
    storeFactory: (file) => { store = new MessageStore(file); return store }
  })
  try {
    runtime.start()
    await setImmediate()
    assert.ok(store.messages('friend', 501).length < 500)
    await runtime.close()
    assert.equal(sourceClosed, true)
    assert.throws(() => store.messages('friend'), /closed|not open/)
  } finally { await runtime.close(); rmSync(dir, { recursive: true, force: true }) }
})

test('concurrent sync requests wait for a second pass and see updates arriving during the first pass', async () => {
  const store = new MessageStore(':memory:')
  const rows = [{ mesLocalID: 1, msgCreateTime: 1, msgContent: 'first', mesDes: 1 }]
  let passes = 0
  const sync = new WechatSync({ store, accountRoot: '/unused', source: {
    sessions: () => { passes++; return [{ username: 'friend' }] },
    *messagePages() { yield [...rows] }
  } })
  try {
    const first = sync.sync()
    await setImmediate()
    rows.unshift({ mesLocalID: 2, msgCreateTime: 2, msgContent: 'new', mesDes: 0 })
    const second = sync.sync()
    assert.equal(first, second)
    await second
    assert.ok(passes >= 2)
    assert.equal(store.messages('friend').length, 2)
  } finally { sync.stop(); store.close() }
})
