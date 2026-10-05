import { MessageStore } from './store.js'
import { WcdbSource } from './wcdb.js'
import { WechatSync } from './sync.js'
import { WechatHistory } from './history.js'
import { readKey } from './keychain.js'

export function createHistoryRuntime(config, {
  env = process.env,
  keyReader = readKey,
  sourceFactory = (options) => new WcdbSource(options),
  storeFactory = (file) => new MessageStore(file),
  syncFactory = (options) => new WechatSync(options),
  log = (message) => console.error(`[wechat-mcp] ${message}`)
} = {}) {
  const key = env.WECHAT_DB_KEY || keyReader(config.accountRoot)
  if (!/^[a-f0-9]{64}$/i.test(key ?? '')) throw new Error('缺少有效微信数据库密钥，请设置 WECHAT_DB_KEY 或保存到钥匙串')
  let source, store, sync
  try {
    source = sourceFactory({ ...config, key })
    store = storeFactory(config.dataFile)
    sync = syncFactory({ source, store, accountRoot: config.accountRoot, onError: () => log('同步失败，请检查微信数据库和账号配置') })
  } catch {
    try { source?.close() } finally { store?.close() }
    throw new Error('无法打开微信数据源或消息缓存，请检查账号目录、数据库密钥和 WCDB 库')
  }
  let closing
  return {
    history: new WechatHistory({ store, sync }),
    start() { sync.start() },
    close() {
      if (!closing) closing = (async () => {
        sync.stop()
        try { await sync.inFlight } catch {}
        try { source.close() } finally { store.close() }
      })()
      return closing
    }
  }
}
