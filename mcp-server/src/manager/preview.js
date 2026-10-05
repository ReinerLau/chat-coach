import { ZodError } from 'zod'
import { MessageStore } from '../store.js'
import { CachedHistory, HistoryError, sessionInput, historyInput } from '../history.js'
import { loadTunnelConfig, ManagerError } from './config.js'

export class PreviewError extends Error {
  constructor(message, status = 503) {
    super(message)
    this.status = status
  }
}

function inputFromQuery(kind, params) {
  const input = {}
  for (const [key, value] of params) {
    if (Object.hasOwn(input, key)) throw new PreviewError('查询参数不能重复。', 400)
    if (['limit', 'offset'].includes(key)) {
      if (!/^\d+$/.test(value)) throw new PreviewError('分页参数必须为整数。', 400)
      input[key] = Number(value)
    } else {
      // Define own properties even for untrusted names such as __proto__.
      Object.defineProperty(input, key, { value, enumerable: true, configurable: true })
    }
  }
  return (kind === 'sessions' ? sessionInput : historyInput).parse(input)
}

export class CachePreview {
  constructor(paths, { env = process.env } = {}) {
    this.paths = paths
    this.env = env
  }

  read(kind, params) {
    let store
    try {
      const input = inputFromQuery(kind, params)
      const config = loadTunnelConfig(this.paths, this.env)
      try { store = new MessageStore(config.dataFile, { readOnly: true }) }
      catch { throw new PreviewError('缓存数据库不可用。请先启动服务完成同步，再刷新预览。') }
      const history = new CachedHistory({ store })
      return kind === 'sessions' ? history.sessions(input) : history.messages(input)
    } catch (error) {
      if (error instanceof PreviewError) throw error
      if (error instanceof ZodError) throw new PreviewError('查询参数无效，请检查会话或分页参数。', 400)
      if (error instanceof HistoryError) throw new PreviewError(error.message, error.status)
      if (error instanceof ManagerError) throw new PreviewError(error.message)
      throw new PreviewError('无法读取缓存数据，请检查缓存数据库或稍后刷新重试。')
    } finally { store?.close() }
  }
}
