import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { setImmediate } from 'node:timers/promises'
import { runForeground } from '../src/manager/foreground.js'

function harness(overrides = {}) {
  const signals = new EventEmitter()
  const manager = { pid: 123, origin: 'http://127.0.0.1:1234', token: 'private-token' }
  const logs = [], errors = [], stops = []
  let alive = true
  const options = {
    signals, pollMs: 5, noOpen: true,
    log: (line) => logs.push(line), report: (line) => errors.push(line),
    isRunning: () => alive,
    launch: async ({ onReady }) => { onReady(manager); return { origin: manager.origin } },
    stop: async (target) => { stops.push(target); alive = false },
    ...overrides
  }
  return { signals, manager, logs, errors, stops, options, disappear: () => { alive = false } }
}

for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  test(`${signal} waits for cleanup of the acquired manager, without logging its token`, async () => {
    const h = harness()
    const foreground = runForeground(h.options)
    await setImmediate()
    assert.match(h.logs.join('\n'), /按 Ctrl\+C/)
    h.signals.emit(signal)
    assert.equal(await foreground, code)
    assert.deepEqual(h.stops, [h.manager])
    assert.match(h.logs.at(-1), /已关闭/)
    assert.doesNotMatch(h.logs.join('\n'), /private-token/)
    assert.equal(h.signals.listenerCount('SIGINT'), 0)
    assert.equal(h.signals.listenerCount('SIGTERM'), 0)
  })
}

test('interrupt during startup waits for initialization and then shuts down that instance', async () => {
  let ready
  const h = harness({ launch: ({ onReady }) => new Promise((resolve) => {
    ready = () => { onReady(h.manager); resolve({ origin: h.manager.origin }) }
  }) })
  const foreground = runForeground(h.options)
  h.signals.emit('SIGINT')
  assert.equal(h.stops.length, 0)
  ready()
  assert.equal(await foreground, 130)
  assert.deepEqual(h.stops, [h.manager])
})

test('repeated Ctrl+C cannot interrupt cleanup or start a second shutdown', async () => {
  let finish
  const calls = []
  const h = harness({ stop: (target) => { calls.push(target); return new Promise((resolve) => { finish = resolve }) } })
  const foreground = runForeground(h.options)
  await setImmediate()
  h.signals.emit('SIGINT')
  await setImmediate()
  h.signals.emit('SIGINT')
  h.signals.emit('SIGTERM')
  assert.equal(calls.length, 1)
  assert.doesNotMatch(h.logs.join('\n'), /已关闭/)
  finish()
  assert.equal(await foreground, 130)
})

test('external shutdown ends the foreground without stopping a replacement instance', async () => {
  const h = harness()
  const foreground = runForeground(h.options)
  await setImmediate()
  h.disappear()
  assert.equal(await foreground, 0)
  assert.equal(h.stops.length, 0)
})

test('startup failure after manager acquisition cleans up before reporting the original error', async () => {
  const h = harness({ launch: async ({ onReady }) => { onReady(h.manager); throw new Error('无法打开浏览器') } })
  await assert.rejects(runForeground(h.options), /无法打开浏览器/)
  assert.deepEqual(h.stops, [h.manager])
  assert.equal(h.signals.listenerCount('SIGINT'), 0)
})

test('interrupted startup failure still closes the acquired manager', async () => {
  const h = harness({ launch: async ({ onReady }) => {
    onReady(h.manager)
    h.signals.emit('SIGINT')
    throw new Error('startup was interrupted')
  } })
  assert.equal(await runForeground(h.options), 130)
  assert.deepEqual(h.stops, [h.manager])
})

test('failed shutdown reports recovery instructions without claiming success', async () => {
  const h = harness({ stop: async () => { throw new Error('private failure details') } })
  const foreground = runForeground(h.options)
  await setImmediate()
  h.signals.emit('SIGINT')
  await assert.rejects(foreground, /wechat-history stop/)
  assert.doesNotMatch(h.logs.join('\n'), /已关闭|private failure/)
  assert.equal(h.signals.listenerCount('SIGINT'), 0)
})

test('service startup errors leave the foreground attached to the usable manager', async () => {
  const h = harness({ launch: async ({ onReady }) => { onReady(h.manager); return { origin: h.manager.origin, error: '微信密钥尚未准备' } } })
  const foreground = runForeground(h.options)
  await setImmediate()
  assert.deepEqual(h.errors, ['微信密钥尚未准备'])
  h.signals.emit('SIGINT')
  assert.equal(await foreground, 130)
  assert.deepEqual(h.stops, [h.manager])
})
