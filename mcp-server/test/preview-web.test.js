import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'
import { setImmediate } from 'node:timers/promises'

const [previewSource, appSource, html] = await Promise.all([
  readFile(new URL('../web/preview.js', import.meta.url), 'utf8'),
  readFile(new URL('../web/app.js', import.meta.url), 'utf8'),
  readFile(new URL('../web/index.html', import.meta.url), 'utf8')
])

class Element {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase()
    this.children = []
    this.attributes = new Map()
    this.listeners = new Map()
    this.hidden = false
    this.disabled = false
    this.className = ''
    this.value = ''
    this.scrollTop = 0
    this.dataset = {}
    this.text = ''
  }

  get textContent() { return this.text + this.children.map((child) => child.textContent).join('') }
  set textContent(value) { this.text = String(value ?? ''); this.children = [] }
  set innerHTML(_) { throw new Error('Preview must render untrusted text through textContent') }
  get childElementCount() { return this.children.length }
  append(...children) { this.children.push(...children) }
  prepend(...children) { this.children.unshift(...children) }
  replaceChildren(...children) { this.text = ''; this.children = [...children]; this.scrollTop = 0 }
  setAttribute(name, value) { this.attributes.set(name, String(value)) }
  getAttribute(name) { return this.attributes.get(name) ?? null }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, [])
    this.listeners.get(type).push(listener)
  }
  fire(type) {
    if (type === 'click' && this.disabled) return
    const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true } }
    for (const listener of this.listeners.get(type) ?? []) listener(event)
    return event
  }
}

function createPage({ withApp = false } = {}) {
  const elements = new Map()
  // Seed real markup defaults so initial selection and empty-state tests cover index.html too.
  for (const match of html.matchAll(/<([a-z][\w-]*)\b([^>]*\bid="([^"]+)"[^>]*)>([^<]*)/g)) {
    const [, tag, attributes, id, text] = match
    const element = new Element(tag)
    element.textContent = text
    element.hidden = /\bhidden\b/.test(attributes)
    element.disabled = /\bdisabled\b/.test(attributes)
    const action = attributes.match(/data-action="([^"]+)"/)
    if (action) element.dataset.action = action[1]
    elements.set(id, element)
  }
  const $ = (id) => {
    assert.ok(elements.has(id), `Missing page element: ${id}`)
    return elements.get(id)
  }
  const document = {
    getElementById: $,
    createElement: (tag) => new Element(tag),
    querySelectorAll: () => [...elements.values()].filter((element) => element.dataset.action)
  }
  const scroll = $('preview-history-scroll')
  let scrollTop = 0
  scroll.clientHeight = 80
  Object.defineProperties(scroll, {
    scrollHeight: { get: () => Math.max(scroll.clientHeight, $('preview-message-list').childElementCount * 40) },
    scrollTop: {
      get: () => scrollTop,
      set: (value) => { scrollTop = Math.max(0, Math.min(value, scroll.scrollHeight - scroll.clientHeight)) }
    }
  })
  const calls = []
  const request = (path, post = false, options) => new Promise((resolve, reject) => {
    calls.push({ path, post, options, resolve, reject, settled: false })
  })
  const intervals = []
  const context = { document, URLSearchParams, $, request }
  if (withApp) {
    Object.assign(context, {
      location: { hash: '', pathname: '/' },
      sessionStorage: { getItem: () => 'preview-test-token' },
      fetch: async (path, options) => {
        const result = await request(path.slice('/api/'.length), options.method === 'POST', options)
        // An Error response models an HTTP API error; rejecting models a transport failure.
        if (result instanceof Error) return { ok: false, json: async () => ({ error: result.message }) }
        return { ok: true, json: async () => result }
      },
      setInterval: (callback, delay) => { intervals.push({ callback, delay }) }
    })
    runInNewContext(appSource, context)
  }
  runInNewContext(previewSource, context)
  return {
    $, calls, intervals,
    pending(kind) {
      const call = calls.find((item) => !item.settled && item.path.split('?')[0] === kind)
      assert.ok(call, `Expected pending request for ${kind}`)
      return call
    },
    async resolve(call, value) { call.settled = true; call.resolve(value); await setImmediate() },
    async reject(call, message) { call.settled = true; call.reject(new Error(message)); await setImmediate() }
  }
}

const alice = { id: 'alice', name: '小王', updatedAt: 1700000000 }
const bob = { id: 'bob', name: '小李', updatedAt: 1700000001 }
const sessionPage = (sessions = [alice, bob], nextOffset = null) => ({ sessions, nextOffset })
const message = (content, extra = {}) => ({ content, createdAt: 1700000000, senderId: 'friend', isSelf: false, type: 1, ...extra })
const historyPage = (session = alice, messages = [message('最近消息')], next = null) => ({ session, messages, next })
const params = (call) => Object.fromEntries(new URL(call.path, 'http://localhost/').searchParams)
const sessionButtons = (page) => page.$('preview-session-list').children
const messageRows = (page) => page.$('preview-message-list').children
const messageTexts = (page) => messageRows(page).map((row) => row.children[1].textContent)

async function loadedPage(nextOffset = null) {
  const page = createPage()
  await page.resolve(page.pending('preview/sessions'), sessionPage(undefined, nextOffset))
  return page
}

async function select(page, index = 0, payload = historyPage()) {
  sessionButtons(page)[index].fire('click')
  const call = page.calls.at(-1)
  assert.equal(call.path.split('?')[0], 'preview/history')
  await page.resolve(call, payload)
}

test('markup loads deferred preview after app and uses its authenticated GET request helper', async () => {
  const scripts = [...html.matchAll(/<script\b([^>]*)><\/script>/g)].map((match) => match[1])
  const appIndex = scripts.findIndex((attributes) => /src="\/app\.js"/.test(attributes))
  const previewIndex = scripts.findIndex((attributes) => /src="\/preview\.js"/.test(attributes))
  assert.ok(appIndex >= 0 && previewIndex > appIndex)
  assert.match(scripts[appIndex], /\bdefer\b/)
  assert.match(scripts[previewIndex], /\bdefer\b/)
  const page = createPage({ withApp: true })
  const call = page.pending('preview/sessions')
  assert.equal(call.post, false)
  assert.equal(call.options.headers['X-Wechat-Manager-Token'], 'preview-test-token')
  assert.equal(call.options.method, undefined)
  await page.resolve(call, sessionPage())
  sessionButtons(page)[0].fire('click')
  const history = page.pending('preview/history')
  assert.equal(history.options.headers['X-Wechat-Manager-Token'], 'preview-test-token')
  assert.equal(history.post, false)
  await page.resolve(history, historyPage())
})

test('initial session load uses 50 rows and leaves history unselected', async () => {
  const page = createPage()
  assert.deepEqual(params(page.pending('preview/sessions')), { query: '', limit: '50', offset: '0' })
  assert.equal(page.$('preview-refresh').disabled, true)
  await page.resolve(page.pending('preview/sessions'), sessionPage())
  assert.equal(page.calls.length, 1)
  assert.equal(page.$('preview-session-name').textContent, '请选择会话')
  assert.equal(page.$('preview-session-id').textContent, '')
  assert.equal(page.$('preview-history-state').textContent, '选择左侧会话，查看最近消息。')
  assert.equal(messageRows(page).length, 0)
  assert.ok(sessionButtons(page).every((button) => button.getAttribute('aria-pressed') === 'false'))
  assert.equal(page.$('preview-earlier').hidden, true)
  assert.equal(page.$('preview-more-sessions').hidden, true)
  assert.equal(page.$('preview-refresh').disabled, false)
})

test('selecting a session requests its latest 50 messages without a history cursor', async () => {
  const page = await loadedPage()
  sessionButtons(page)[1].fire('click')
  const call = page.pending('preview/history')
  assert.deepEqual(params(call), { session_id: 'bob', limit: '50' })
  assert.equal(page.$('preview-refresh').disabled, true)
  await page.resolve(call, historyPage(bob))
  assert.equal(page.$('preview-session-name').textContent, bob.name)
  assert.equal(page.$('preview-session-id').textContent, bob.id)
  assert.equal(sessionButtons(page)[1].getAttribute('aria-pressed'), 'true')
  assert.match(sessionButtons(page)[1].className, /\bselected\b/)
  assert.deepEqual(messageTexts(page), ['最近消息'])
})

test('search trims and encodes query, clears selection, messages, errors and both pagination cursors', async () => {
  const page = await loadedPage(50)
  await select(page, 0, historyPage(alice, [message('旧消息')], 'old-cursor'))
  page.$('preview-query').value = '  小王 & /?  '
  const event = page.$('preview-search').fire('submit')
  assert.equal(event.defaultPrevented, true)
  assert.deepEqual(params(page.pending('preview/sessions')), { query: '小王 & /?', limit: '50', offset: '0' })
  assert.equal(page.$('preview-session-name').textContent, '请选择会话')
  assert.equal(page.$('preview-session-id').textContent, '')
  assert.equal(messageRows(page).length, 0)
  assert.equal(sessionButtons(page).length, 0)
  assert.equal(page.$('preview-earlier').hidden, true)
  assert.equal(page.$('preview-more-sessions').hidden, true)
  assert.equal(page.$('preview-history-error').hidden, true)
  await page.resolve(page.pending('preview/sessions'), sessionPage([bob]))
  const count = page.calls.length
  page.$('preview-earlier').fire('click')
  assert.equal(page.calls.length, count)
  await select(page, 0, historyPage(bob))
  assert.deepEqual(params(page.calls.at(-1)), { session_id: 'bob', limit: '50' })
})

test('loading more sessions appends in order, keeps selection and prevents duplicate busy requests', async () => {
  const page = await loadedPage(50)
  const list = page.$('preview-session-list')
  list.scrollTop = 37
  await select(page)
  assert.equal(list.scrollTop, 37, 'Selecting and loading history preserves session-list scroll')
  page.$('preview-more-sessions').fire('click')
  const call = page.pending('preview/sessions')
  assert.deepEqual(params(call), { query: '', limit: '50', offset: '50' })
  assert.equal(page.$('preview-more-sessions').disabled, true)
  const count = page.calls.length
  page.$('preview-more-sessions').fire('click')
  assert.equal(page.calls.length, count)
  const third = { id: 'third', name: '第三个会话', updatedAt: 1700000002 }
  await page.resolve(call, sessionPage([third]))
  assert.equal(list.scrollTop, 37, 'Appending sessions preserves session-list scroll')
  assert.deepEqual(sessionButtons(page).map((button) => button.children[1].textContent), ['alice', 'bob', 'third'])
  assert.equal(sessionButtons(page)[0].getAttribute('aria-pressed'), 'true')
  assert.deepEqual(messageTexts(page), ['最近消息'])
  assert.equal(page.$('preview-more-sessions').hidden, true)
})

for (const staleOutcome of ['success', 'error']) {
  test(`switching sessions ignores a stale history ${staleOutcome} while the new request is pending`, async () => {
    const page = await loadedPage()
    sessionButtons(page)[0].fire('click')
    const oldCall = page.pending('preview/history')
    sessionButtons(page)[1].fire('click')
    const newCall = page.calls.at(-1)
    if (staleOutcome === 'success') await page.resolve(oldCall, historyPage(alice, [message('过期消息')], 'stale-cursor'))
    else await page.reject(oldCall, '过期读取错误')
    assert.equal(page.$('preview-session-id').textContent, 'bob')
    assert.equal(messageRows(page).length, 0)
    assert.equal(page.$('preview-history-error').hidden, true)
    assert.equal(page.$('preview-earlier').hidden, true)
    assert.equal(page.$('preview-refresh').disabled, true)
    await page.resolve(newCall, historyPage(bob, [message('当前消息')]))
    assert.deepEqual(messageTexts(page), ['当前消息'])
    assert.equal(page.$('preview-refresh').disabled, false)
  })

  test(`switching sessions ignores a stale earlier-page ${staleOutcome} after the new history loads`, async () => {
    const page = await loadedPage()
    await select(page, 0, historyPage(alice, [message('旧会话')], 'alice-cursor'))
    page.$('preview-earlier').fire('click')
    const oldCall = page.pending('preview/history')
    await select(page, 1, historyPage(bob, [message('新会话')], 'bob-cursor'))
    if (staleOutcome === 'success') await page.resolve(oldCall, historyPage(alice, [message('旧历史')], 'wrong-cursor'))
    else await page.reject(oldCall, '旧会话读取失败')
    assert.equal(page.$('preview-session-id').textContent, 'bob')
    assert.deepEqual(messageTexts(page), ['新会话'])
    assert.equal(page.$('preview-history-error').hidden, true)
    assert.equal(page.$('preview-refresh').disabled, false)
    page.$('preview-earlier').fire('click')
    assert.deepEqual(params(page.calls.at(-1)), { session_id: 'bob', limit: '50', before: 'bob-cursor' })
  })

  test(`search ignores stale session and history ${staleOutcome} responses`, async () => {
    const page = await loadedPage(50)
    sessionButtons(page)[0].fire('click')
    const oldHistory = page.pending('preview/history')
    page.$('preview-more-sessions').fire('click')
    const oldSessions = page.pending('preview/sessions')
    page.$('preview-query').value = '新搜索'
    page.$('preview-search').fire('submit')
    const newSessions = page.calls.at(-1)
    await page.resolve(newSessions, sessionPage([bob]))
    if (staleOutcome === 'success') {
      await page.resolve(oldHistory, historyPage(alice, [message('过期')], 'old'))
      await page.resolve(oldSessions, sessionPage([alice], 100))
    } else {
      await page.reject(oldHistory, '旧历史失败')
      await page.reject(oldSessions, '旧列表失败')
    }
    assert.deepEqual(sessionButtons(page).map((button) => button.children[1].textContent), ['bob'])
    assert.equal(page.$('preview-session-name').textContent, '请选择会话')
    assert.equal(messageRows(page).length, 0)
    assert.equal(page.$('preview-more-sessions').hidden, true)
    assert.equal(page.$('preview-earlier').hidden, true)
    assert.equal(page.$('preview-history-error').hidden, true)
    assert.equal(page.$('preview-sessions-error').hidden, true)
    assert.equal(page.$('preview-refresh').disabled, false)
  })
}

test('message and session text stay literal, with self sender, fallback name and server non-text placeholder', async () => {
  const page = createPage()
  const session = { ...alice, name: '<img src=x onerror=alert(1)>' }
  await page.resolve(page.pending('preview/sessions'), sessionPage([session]))
  assert.equal(sessionButtons(page)[0].children[0].textContent, session.name)
  assert.equal(sessionButtons(page)[0].children[0].childElementCount, 0)
  const unsafe = '<script>alert("x")</script> & <b>原样</b>\n下一行'
  await select(page, 0, historyPage(session, [
    message(unsafe, { senderId: '<svg onload=alert(1)>' }),
    message('自己的消息', { isSelf: true, senderId: 'other-name' }),
    message('没有发送者', { senderId: '' }),
    message('[非文本消息：类型 3]', { type: 3 })
  ]))
  assert.deepEqual(messageTexts(page), [unsafe, '自己的消息', '没有发送者', '[非文本消息：类型 3]'])
  assert.ok(messageRows(page).every((row) => row.children[1].childElementCount === 0))
  assert.equal(messageRows(page)[0].children[0].children[0].textContent, '<svg onload=alert(1)>')
  assert.equal(messageRows(page)[1].children[0].children[0].textContent, '我')
  assert.match(messageRows(page)[1].className, /\bself\b/)
  assert.doesNotMatch(messageRows(page)[0].className, /\bself\b/)
  assert.equal(messageRows(page)[2].children[0].children[0].textContent, session.name)
})

test('prepending older messages preserves visible scroll anchor and consumes the opaque 50-row cursor', async () => {
  const page = await loadedPage()
  const cursor = 'opaque+/=?&cursor'
  await select(page, 0, historyPage(alice, Array.from({ length: 6 }, (_, index) => message(`最近${index}`)), cursor))
  const scroll = page.$('preview-history-scroll')
  assert.equal(scroll.scrollTop, scroll.scrollHeight - scroll.clientHeight)
  scroll.scrollTop = 55
  const oldHeight = scroll.scrollHeight
  const oldRows = [...messageRows(page)]
  page.$('preview-earlier').fire('click')
  const call = page.pending('preview/history')
  assert.deepEqual(params(call), { session_id: 'alice', limit: '50', before: cursor })
  assert.equal(page.$('preview-earlier').disabled, true)
  const count = page.calls.length
  page.$('preview-earlier').fire('click')
  assert.equal(page.calls.length, count)
  await page.resolve(call, historyPage(alice, [message('更早0'), message('更早1')]))
  assert.ok(scroll.scrollHeight > oldHeight)
  assert.equal(scroll.scrollTop, 55 + scroll.scrollHeight - oldHeight)
  assert.deepEqual(messageTexts(page), ['更早0', '更早1', '最近0', '最近1', '最近2', '最近3', '最近4', '最近5'])
  assert.deepEqual(messageRows(page).slice(2), oldRows)
  assert.equal(page.$('preview-earlier').hidden, true)
})

test('manual refresh reloads list offset zero and replaces current history with latest messages at bottom', async () => {
  const page = await loadedPage(50)
  await select(page, 0, historyPage(alice, Array.from({ length: 6 }, (_, index) => message(`旧${index}`)), 'old-cursor'))
  page.$('preview-query').value = '尚未提交的搜索'
  page.$('preview-history-scroll').scrollTop = 20
  page.$('preview-refresh').fire('click')
  const listCall = page.pending('preview/sessions')
  const historyCall = page.pending('preview/history')
  assert.deepEqual(params(listCall), { query: '', limit: '50', offset: '0' })
  assert.deepEqual(params(historyCall), { session_id: 'alice', limit: '50' })
  assert.equal(messageRows(page).length, 0)
  assert.equal(page.$('preview-earlier').hidden, true)
  assert.equal(page.$('preview-more-sessions').hidden, true)
  await page.resolve(listCall, sessionPage())
  assert.equal(page.$('preview-refresh').disabled, true)
  await page.resolve(historyCall, historyPage(alice, Array.from({ length: 7 }, (_, index) => message(`新${index}`)), 'new-cursor'))
  const scroll = page.$('preview-history-scroll')
  assert.deepEqual(messageTexts(page), Array.from({ length: 7 }, (_, index) => `新${index}`))
  assert.equal(scroll.scrollTop, scroll.scrollHeight - scroll.clientHeight)
  assert.equal(sessionButtons(page)[0].getAttribute('aria-pressed'), 'true')
  assert.equal(page.$('preview-refresh').disabled, false)
  page.$('preview-earlier').fire('click')
  assert.equal(params(page.calls.at(-1)).before, 'new-cursor')
})

test('refresh with no selection retains submitted search and never requests history', async () => {
  const page = await loadedPage()
  page.$('preview-query').value = '小李'
  page.$('preview-search').fire('submit')
  await page.resolve(page.pending('preview/sessions'), sessionPage([bob], 50))
  page.$('preview-refresh').fire('click')
  assert.deepEqual(params(page.pending('preview/sessions')), { query: '小李', limit: '50', offset: '0' })
  assert.ok(page.calls.every((call) => call.path.startsWith('preview/sessions?')))
})

test('failed list and history reads recover on refresh without changing service state or its error', async () => {
  const page = createPage({ withApp: true })
  await page.resolve(page.pending('status'), {
    state: 'running', mcp: 'running', tunnel: 'connected', sync: { phase: 'idle' },
    logs: [], error: '原有服务提示'
  })
  const serviceStatus = page.$('status').textContent
  const serviceError = page.$('error').textContent
  await page.resolve(page.pending('preview/sessions'), new Error('缓存暂不可读'))
  assert.equal(page.$('preview-sessions-error').textContent, '缓存暂不可读')
  assert.equal(page.$('preview-sessions-error').hidden, false)
  assert.equal(page.$('preview-refresh').disabled, false)
  page.$('preview-refresh').fire('click')
  assert.equal(page.$('preview-sessions-error').hidden, true)
  await page.resolve(page.pending('preview/sessions'), sessionPage())
  sessionButtons(page)[0].fire('click')
  await page.resolve(page.pending('preview/history'), new Error('读取历史失败'))
  assert.equal(page.$('preview-history-error').textContent, '读取历史失败')
  assert.equal(page.$('preview-history-error').hidden, false)
  assert.equal(page.$('preview-refresh').disabled, false)
  page.$('preview-refresh').fire('click')
  assert.equal(page.$('preview-history-error').hidden, true)
  assert.equal(page.$('preview-history-error').textContent, '')
  assert.deepEqual(params(page.pending('preview/history')), { session_id: 'alice', limit: '50' })
  await page.resolve(page.pending('preview/sessions'), sessionPage())
  await page.resolve(page.pending('preview/history'), historyPage())
  assert.deepEqual(messageTexts(page), ['最近消息'])
  assert.equal(page.$('status').textContent, serviceStatus)
  assert.equal(page.$('error').textContent, serviceError)
  assert.equal(page.$('error').hidden, false)
  assert.equal(page.$('preview-refresh').disabled, false)
  assert.ok(page.calls.every((call) => !call.post))
})

test('cache-empty, no-search-match and empty-history states use distinct Chinese guidance', async () => {
  const page = createPage()
  await page.resolve(page.pending('preview/sessions'), sessionPage([]))
  assert.equal(page.$('preview-sessions-state').textContent, '暂无缓存会话，请先启动服务完成同步。')
  assert.equal(page.$('preview-sessions-error').hidden, true)
  page.$('preview-query').value = '不存在'
  page.$('preview-search').fire('submit')
  await page.resolve(page.pending('preview/sessions'), sessionPage([]))
  assert.equal(page.$('preview-sessions-state').textContent, '没有匹配的会话。')
  page.$('preview-query').value = '  '
  page.$('preview-search').fire('submit')
  await page.resolve(page.pending('preview/sessions'), sessionPage([alice]))
  assert.equal(page.$('preview-sessions-state').textContent, '')
  await select(page, 0, historyPage(alice, []))
  assert.equal(page.$('preview-history-state').textContent, '该会话暂无缓存消息。')
  assert.equal(page.$('preview-history-error').hidden, true)
  assert.equal(page.$('preview-earlier').hidden, true)
  assert.equal(messageRows(page).length, 0)
})
