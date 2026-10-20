import test from 'node:test'
import assert from 'node:assert/strict'
import { keychainHelperPath } from '../src/keychain.js'
import { normalizeMessage, parseQuotedReply } from '../src/normalize.js'
import { WechatHistory } from '../src/history.js'

test('keychain helper lives in writable user data, outside the installed package', () => {
  assert.equal(keychainHelperPath('/tmp/coach-home'), '/tmp/coach-home/.wechat-history-mcp/native/keychain')
})

test('normalizes WCDB message direction and ids', () => {
  const message = normalizeMessage({ mesLocalID: '0:17', msgContent: '你好', mesDes: 0, msgCreateTime: '123', messageType: '1' }, 'friend')
  assert.deepEqual(message, { sessionId: 'friend', localId: '0:17', serverId: '', createdAt: 123, type: 1, isSelf: true, content: '你好', senderId: '' })
})

test('parses quoted replies, preserving the reply text and referenced sender/content', () => {
  const xml = '<msg><appmsg><title>收到</title><refermsg><type>1</type><displayname>黄敏</displayname><content>喝腻了已经 &amp; 不想喝</content></refermsg></appmsg></msg>'
  assert.deepEqual(parseQuotedReply(xml), {
    content: '收到\n引用（黄敏）：喝腻了已经 & 不想喝', replyContent: '收到',
    quotedContent: '喝腻了已经 & 不想喝', quotedSender: '黄敏', quotedType: '1'
  })
  assert.equal(parseQuotedReply('<msg><appmsg><title>普通分享</title></appmsg></msg>'), null)
})

test('each read closes its temporary source, including failed reads', () => {
  let closes = 0
  const source = { sessions: () => [{ username: 'friend', nickname: '朋友', updatedAt: 2 }],
    messagePage: () => [{ mesLocalID: '0:1', msgCreateTime: 1, messageType: 49, mesDes: 0,
      msgContent: '<msg><appmsg><title>我还真喝腻了</title><refermsg><type>1</type><displayname>黄敏</displayname><content>喝腻了已经</content></refermsg></appmsg></msg>' }],
    close: () => { closes++ } }
  const history = new WechatHistory({ openSource: () => source })
  const result = history.messages({ session_id: 'friend' })
  assert.equal(result.messages[0].content, '我还真喝腻了\n引用（黄敏）：喝腻了已经')
  assert.equal(result.messages[0].quotedContent, '喝腻了已经')
  assert.equal(closes, 1)
  assert.throws(() => history.messages({ session_id: 'missing' }), /会话不存在/)
  assert.equal(closes, 2)
  source.messagePage = () => { throw new Error('source failed') }
  assert.throws(() => history.messages({ session_id: 'friend' }), /source failed/)
  assert.equal(closes, 3)
})
