import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { setImmediate } from 'node:timers/promises'

test('page loses its backend gracefully with Chinese recovery instructions and disabled controls', async () => {
  const elements = new Map()
  const buttons = Array.from({ length: 3 }, () => ({ disabled: false, addEventListener() {} }))
  const document = {
    getElementById(id) { if (!elements.has(id)) elements.set(id, {}); return elements.get(id) },
    querySelectorAll: () => buttons
  }
  runInNewContext(await readFile(new URL('../web/app.js', import.meta.url), 'utf8'), {
    document, location: { hash: '' }, sessionStorage: { getItem: () => 'test-token' },
    fetch: async () => { throw new TypeError('Failed to fetch') }, setInterval() {}
  })
  await setImmediate()
  assert.equal(elements.get('status').textContent, '管理后台不可用')
  assert.match(elements.get('error').textContent, /重新运行 wechat-mcp/)
  assert.doesNotMatch(elements.get('error').textContent, /Failed to fetch/)
  assert.ok(buttons.every((button) => button.disabled))
})
