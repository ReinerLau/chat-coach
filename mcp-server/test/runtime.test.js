import test from 'node:test'
import assert from 'node:assert/strict'
import { createHistoryRuntime } from '../src/runtime.js'
import { parseConfig } from '../src/config.js'

test('CLI accepts but ignores legacy cache and status file arguments', () => {
  const config = parseConfig(['--account-root', '/wechat/one', '--data-file', '/tmp/old.sqlite', '--status-file', '/tmp/old.json'])
  assert.equal(config.accountRoot, '/wechat/one')
  assert.equal(config.dataFile, undefined)
  assert.equal(config.statusFile, undefined)
  assert.equal(parseConfig(['--help']).help, true)
  for (const args of [[], ['--account-root', ''], ['--account-root', '/a', '--data-file', ''], ['--account-root', '/a', '--status-file', ''], ['--wrong']]) {
    assert.throws(() => parseConfig(args))
  }
})

test('runtime opens a fresh source for each request and closes it', async () => {
  let opens = 0, closes = 0, keyReads = 0
  const runtime = createHistoryRuntime({ accountRoot: '/account' }, {
    env: {}, keyReader: () => { keyReads++; return 'a'.repeat(64) },
    sourceFactory: ({ key }) => {
      assert.equal(key, 'a'.repeat(64)); opens++
      return { sessions: () => [{ username: 'friend', nickname: '朋友', updatedAt: 1 }],
        messagePage: () => [], close: () => { closes++ } }
    }
  })
  runtime.start()
  runtime.history.sessions({})
  runtime.history.messages({ session_id: 'friend' })
  assert.equal(opens, 3)
  assert.equal(closes, 3)
  assert.equal(keyReads, 4)
  await runtime.close()
  assert.throws(() => runtime.history.sessions({}), /服务已关闭/)
})

test('invalid keys and source failures do not expose secret values', () => {
  assert.throws(() => createHistoryRuntime({ accountRoot: '/account' }, {
    env: { WECHAT_DB_KEY: 'invalid' }, keyReader: () => null
  }), /有效微信数据库密钥/)
  let closes = 0
  const runtime = createHistoryRuntime({ accountRoot: '/account' }, {
    env: { WECHAT_DB_KEY: 'b'.repeat(64) },
    keyReader: () => { throw new Error('must not read keychain') },
    sourceFactory: () => ({ sessions: () => { throw new Error('private body') }, close: () => { closes++ } })
  })
  assert.throws(() => runtime.history.sessions({}), /private body/)
  assert.equal(closes, 1)
})
