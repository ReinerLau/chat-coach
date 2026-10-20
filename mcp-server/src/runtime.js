import { WcdbSource } from './wcdb.js'
import { WechatHistory } from './history.js'
import { readKey } from './keychain.js'

export function createHistoryRuntime(config, {
  env = process.env,
  keyReader = readKey,
  sourceFactory = (options) => new WcdbSource(options)
} = {}) {
  const getKey = () => env.WECHAT_DB_KEY || keyReader(config.accountRoot)
  if (!/^[a-f0-9]{64}$/i.test(getKey() ?? '')) throw new Error('缺少有效微信数据库密钥，请设置 WECHAT_DB_KEY 或保存到钥匙串')
  let closed = false
  const history = new WechatHistory({ openSource: () => {
      if (closed) throw new Error('服务已关闭')
      const key = getKey()
      if (!/^[a-f0-9]{64}$/i.test(key ?? '')) throw new Error('缺少有效微信数据库密钥')
      return sourceFactory({ ...config, key })
    } })
  return {
    history,
    start() { history.withSource((source) => { source.sessions() }) },
    async close() { closed = true }
  }
}
