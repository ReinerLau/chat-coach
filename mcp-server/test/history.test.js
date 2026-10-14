import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { MessageStore } from '../src/store.js'
import { WechatSync } from '../src/sync.js'
import { normalizeMessage, parseQuotedReply } from '../src/normalize.js'
import { CachedHistory } from '../src/history.js'
import { keychainHelperPath } from '../src/keychain.js'

test('keychain helper lives in writable user data, outside the installed package', () => {
  assert.equal(keychainHelperPath('/tmp/coach-home'), '/tmp/coach-home/.wechat-history-mcp/native/keychain')
})

test('normalizes WCDB message direction and ids', () => {
  const message = normalizeMessage({ mesLocalID: 17, msgContent: '你好', mesDes: 0, msgCreateTime: '123', messageType: '1' }, 'friend')
  assert.deepEqual(message, { sessionId: 'friend', localId: '17', serverId: '', createdAt: 123, type: 1, isSelf: true, content: '你好', senderId: '' })
})

test('parses quoted replies, preserving the reply text and referenced sender/content', () => {
  const xml = '<msg><appmsg><title>收到</title><type>57</type><refermsg><type>1</type><displayname>黄敏</displayname><content>喝腻了已经 &amp; 不想喝</content></refermsg></appmsg></msg>'
  assert.deepEqual(parseQuotedReply(xml), {
    content: '收到\n引用（黄敏）：喝腻了已经 & 不想喝',
    replyContent: '收到',
    quotedContent: '喝腻了已经 & 不想喝',
    quotedSender: '黄敏',
    quotedType: '1'
  })
  assert.deepEqual(parseQuotedReply('<msg><appmsg><title>收到</title><refermsg><type>3</type><displayname>黄敏</displayname><content>image payload</content></refermsg></appmsg></msg>'), {
    content: '收到\n引用（黄敏）：[图片]',
    replyContent: '收到',
    quotedContent: '[图片]',
    quotedSender: '黄敏',
    quotedType: '3'
  })
  assert.equal(parseQuotedReply('<msg><appmsg><title>普通分享</title></appmsg></msg>'), null)
})

test('history returns quoted reply context in readable and structured fields', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'coach-'))
  const store = new MessageStore(join(dir, 'messages.sqlite'))
  t.after(() => { store.close(); rmSync(dir, { recursive: true, force: true }) })
  store.saveSession({ id: 'friend', name: '朋友' })
  store.saveMessages([normalizeMessage({
    mesLocalID: 1,
    msgContent: '<msg><appmsg><title>我还真喝腻了</title><type>57</type><refermsg><type>1</type><displayname>黄敏</displayname><content>喝腻了已经</content></refermsg></appmsg></msg>',
    messageType: 49,
    mesDes: 0,
    msgCreateTime: 1
  }, 'friend')])

  const result = new CachedHistory({ store }).messages({ session_id: 'friend' })
  assert.deepEqual(result.messages[0], {
    sessionId: 'friend', localId: '1', serverId: '', createdAt: 1, type: 49,
    isSelf: true,
    content: '我还真喝腻了\n引用（黄敏）：喝腻了已经',
    senderId: '', replyContent: '我还真喝腻了', quotedContent: '喝腻了已经',
    quotedSender: '黄敏', quotedType: '1'
  })
})

test('sync backfills previously blank quoted-message payloads once', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'coach-'))
  const store = new MessageStore(join(dir, 'messages.sqlite'))
  t.after(() => { store.close(); rmSync(dir, { recursive: true, force: true }) })
  store.saveSession({ id: 'friend', name: '朋友' }, 1)
  store.saveMessages([normalizeMessage({
    mesLocalID: '0:1', msgContent: '', messageType: 244813135921, mesDes: 0, msgCreateTime: 1
  }, 'friend')])
  store.markHistoryComplete('friend')
  const xml = '<msg><appmsg><title>收到</title><refermsg><type>1</type><displayname>黄敏</displayname><content>喝腻了已经</content></refermsg></appmsg></msg>'
  const source = {
    sessions: () => [{ username: 'friend', nickname: '朋友' }],
    *messagePages() {
      yield [{ mesLocalID: '0:1', msgContent: xml, messageType: 244813135921, mesDes: 0, msgCreateTime: 1 }]
    }
  }

  await new WechatSync({ source, store, accountRoot: dir }).sync()
  assert.equal(store.isQuoteContentBackfillComplete('friend'), true)
  assert.equal(store.messages('friend', 10)[0].content, xml)
  assert.equal(new CachedHistory({ store }).messages({ session_id: 'friend' }).messages[0].quotedContent, '喝腻了已经')
})

test('sync imports all pages, persists messages, then deduplicates updates', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'coach-'))
  const store = new MessageStore(join(dir, 'messages.sqlite'))
  const rows = Array.from({ length: 5 }, (_, i) => ({ mesLocalID: 5 - i, msgContent: `消息${5 - i}`, msgCreateTime: 5 - i, mesDes: 1 }))
  const source = { sessions: () => [{ username: 'friend', nickname: '朋友' }], messages: (_id, limit, offset) => rows.slice(offset, offset + limit) }
  try {
    const sync = new WechatSync({ source, store, accountRoot: dir, pageSize: 2 })
    await sync.sync()
    assert.equal(store.messages('friend', 100).length, 5)
    rows.unshift({ mesLocalID: 6, msgContent: '新消息', msgCreateTime: 6, mesDes: 1 })
    await sync.sync()
    assert.equal(store.messages('friend', 100).length, 6)
    assert.equal(store.sessions()[0].updatedAt, 6)
    await sync.sync()
    assert.equal(store.messages('friend', 100).length, 6)
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }) }
})

test('interrupted initial import resumes past already saved messages', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'coach-'))
  const store = new MessageStore(join(dir, 'messages.sqlite'))
  const rows = [3, 2, 1].map((id) => ({ mesLocalID: id, msgContent: String(id), msgCreateTime: id, mesDes: 1 }))
  const source = { sessions: () => [{ username: 'friend' }], messages: (_id, limit, offset) => rows.slice(offset, offset + limit) }
  try {
    store.saveMessages([normalizeMessage(rows[0], 'friend')])
    await new WechatSync({ source, store, accountRoot: dir, pageSize: 2 }).sync()
    assert.equal(store.messages('friend', 10).length, 3)
    assert.equal(store.isHistoryComplete('friend'), true)
    assert.equal(store.session('friend').updatedAt, 3)
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }) }
})

test('database WAL file change triggers an incremental readback', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'coach-'))
  mkdirSync(join(dir, 'db_storage'))
  const store = new MessageStore(join(dir, 'messages.sqlite'))
  const rows = []
  const source = { sessions: () => [{ username: 'friend' }], messages: (_id, limit, offset) => rows.slice(offset, offset + limit) }
  const sync = new WechatSync({ source, store, accountRoot: dir, pageSize: 2 })
  try {
    sync.start()
    await new Promise((resolve) => setTimeout(resolve, 50))
    rows.push({ mesLocalID: 1, msgContent: '收到', msgCreateTime: 1, mesDes: 1 })
    writeFileSync(join(dir, 'db_storage', 'message_0.db-wal'), 'changed')
    await new Promise((resolve) => setTimeout(resolve, 600))
    assert.equal(store.messages('friend').length, 1)
  } finally { sync.stop(); store.close(); rmSync(dir, { recursive: true, force: true }) }
})

test('incremental readback includes a new message after an already known row with the same time', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'coach-'))
  const store = new MessageStore(join(dir, 'messages.sqlite'))
  const rows = [
    { mesLocalID: 9, msgContent: 'known', msgCreateTime: 100, mesDes: 1 },
    { mesLocalID: 8, msgContent: 'late', msgCreateTime: 100, mesDes: 1 },
    { mesLocalID: 7, msgContent: 'old', msgCreateTime: 60, mesDes: 1 }
  ]
  const source = { sessions: () => [{ username: 'friend' }], messages: (_id, limit, offset) => rows.slice(offset, offset + limit) }
  try {
    store.saveSession({ id: 'friend', name: 'friend' }, 100)
    store.saveMessages([normalizeMessage(rows[0], 'friend'), normalizeMessage(rows[2], 'friend')])
    store.markHistoryComplete('friend')
    await new WechatSync({ source, store, accountRoot: dir, pageSize: 2 }).sync()
    assert.equal(store.messages('friend', 10).length, 3)
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }) }
})
