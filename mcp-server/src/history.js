import { z } from 'zod'
import { normalizeMessage, normalizeSession, parseQuotedReply } from './normalize.js'

export const sessionInput = z.object({
  query: z.string().trim().max(200).default('').describe('会话名称或会话 ID 的部分文字；同名会话会返回多个候选会话'),
  limit: z.number().int().min(1).max(200).default(50).describe('每页会话数，最多 200'),
  offset: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 201).default(0).describe('上一页 nextOffset；更换查询时从 0 开始')
}).strict()

export const historyInput = z.object({
  session_id: z.string().min(1).max(500).describe('list_wechat_sessions 返回的 sessions[].id，即会话 ID，不是联系人名称'),
  limit: z.number().int().min(1).max(200).default(50).describe('每页消息数，默认 50，最多 200'),
  before: z.string().min(1).max(2048).optional().describe('上一页的 next 游标；省略时读取最近消息')
}).strict()

const cursorSchema = z.object({
  sessionId: z.string().min(1),
  createdAt: z.number().int().nonnegative(),
  localId: z.string().regex(/^\d+:-?\d+$/)
}).strict()

export class HistoryError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.status = status
  }
}

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

function readableMessage(row) {
  const quote = parseQuotedReply(row.content)
  if (quote) return { ...row, ...quote }
  return { ...row, content: row.type === 1 ? row.content : `[非文本消息：类型 ${row.type}]` }
}

export class WechatHistory {
  constructor({ openSource }) { this.openSource = openSource }

  withSource(read) {
    const source = this.openSource()
    try { return read(source) }
    finally { source.close() }
  }

  sessions(input) {
    const { query, limit, offset } = sessionInput.parse(input)
    return this.withSource((source) => {
      const matches = source.sessions().map((row) => {
        const session = normalizeSession(row)
        return session && { ...session, updatedAt: Number(row.updatedAt) || 0 }
      }).filter(Boolean).filter((session) =>
        session.name.toLowerCase().includes(query.toLowerCase()) || session.id.toLowerCase().includes(query.toLowerCase()))
      matches.sort((a, b) => b.updatedAt - a.updatedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      return { sessions: matches.slice(offset, offset + limit), nextOffset: matches.length > offset + limit ? offset + limit : null }
    })
  }

  messages(input) {
    const { session_id: sessionId, limit, before } = historyInput.parse(input)
    const cursor = decodeCursor(before, sessionId)
    return this.withSource((source) => {
      const raw = source.sessions().find((row) => String(row.username) === sessionId)
      if (!raw) throw new HistoryError('会话不存在，请先查找会话并使用返回的会话 ID', 404)
      const session = { ...normalizeSession(raw), updatedAt: Number(raw.updatedAt) || 0 }
      const descending = source.messagePage(sessionId, limit + 1, cursor).map((row) => normalizeMessage(row, sessionId)).filter(Boolean)
      const messages = descending.slice(0, limit).reverse().map(readableMessage)
      const oldest = messages[0]
      const next = descending.length > limit ? Buffer.from(JSON.stringify({
        sessionId, createdAt: oldest.createdAt, localId: oldest.localId
      })).toString('base64url') : null
      return { session, messages, next }
    })
  }
}
