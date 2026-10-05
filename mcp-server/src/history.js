import { z } from 'zod'

export const sessionInput = z.object({
  query: z.string().trim().max(200).default('').describe('会话名称或微信 ID 的部分文字；同名会话会返回多个候选'),
  limit: z.number().int().min(1).max(200).default(50).describe('每页会话数，最多 200'),
  offset: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 201).default(0).describe('上一页 nextOffset；更换查询时从 0 开始')
}).strict()

export const historyInput = z.object({
  session_id: z.string().min(1).max(500).describe('list_wechat_sessions 返回的会话 ID，不是联系人名称'),
  limit: z.number().int().min(1).max(200).default(50).describe('每页消息数，默认 50，最多 200'),
  before: z.string().min(1).max(2048).optional().describe('上一页的 next 游标；省略时读取最近消息')
}).strict()

const cursorSchema = z.object({
  sessionId: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  localId: z.string().min(1)
}).strict()

export class HistoryError extends Error {}

function decodeCursor(value, sessionId) {
  if (value === undefined) return null
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error()
    const buffer = Buffer.from(value, 'base64url')
    if (buffer.toString('base64url') !== value) throw new Error()
    const cursor = cursorSchema.parse(JSON.parse(buffer.toString('utf8')))
    if (cursor.sessionId !== sessionId) throw new Error()
    return cursor
  } catch { throw new HistoryError('分页游标无效或属于其他会话') }
}

export class WechatHistory {
  constructor({ store, sync }) {
    this.store = store
    this.sync = sync
  }

  async refresh() {
    try { await this.sync.sync() }
    catch { throw new HistoryError('微信同步失败，请检查数据库密钥、微信账号目录和本机服务状态') }
  }

  async sessions(input) {
    const { query, limit, offset } = sessionInput.parse(input)
    await this.refresh()
    const rows = this.store.sessions({ query, limit: limit + 1, offset })
    return { sessions: rows.slice(0, limit), nextOffset: rows.length > limit ? offset + limit : null }
  }

  async messages(input) {
    const { session_id: sessionId, limit, before } = historyInput.parse(input)
    const cursor = decodeCursor(before, sessionId)
    await this.refresh()
    const session = this.store.session(sessionId)
    if (!session) throw new HistoryError('会话不存在，请先查找会话并使用返回的 ID')
    const rows = this.store.messages(sessionId, limit + 1, cursor)
    const messages = rows.slice(-limit).map((row) => ({
      ...row,
      content: row.type === 1 ? row.content : `[非文本消息：类型 ${row.type}]`
    }))
    const oldest = messages[0]
    const next = rows.length > limit ? Buffer.from(JSON.stringify({
      sessionId, createdAt: oldest.createdAt, localId: oldest.localId
    })).toString('base64url') : null
    return { session, messages, next }
  }
}
