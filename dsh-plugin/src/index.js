import { fileURLToPath } from 'node:url'
import z from '@deepseek-ai/schemastery'
import { MessageStore } from './store.js'
import { WcdbSource } from './wcdb.js'
import { WechatSync } from './sync.js'
import { createApi, registerWebRoutes } from './http.js'
import { readKey } from './keychain.js'

export const name = 'wechat-coach'
export const inject = ['webServer', 'llm']
export const Config = z.object({
  accountRoot: z.string().required(),
  libraryPath: z.string().default(fileURLToPath(new URL('../vendor/weflow/libWCDB.dylib', import.meta.url))),
  dataFile: z.string().required(),
  keyEnv: z.string().default('WECHAT_DB_KEY'),
  provider: z.string().required(),
  model: z.string().required()
})

export function apply(ctx, config) {
  if (ctx.webServer.host !== '127.0.0.1') throw new Error('微信教练需要 DSH 监听 127.0.0.1；手机访问请使用 dsh-pocket')
  const key = process.env[config.keyEnv] || readKey(config.accountRoot)
  if (!key) throw new Error('缺少微信数据库密钥')
  const store = new MessageStore(config.dataFile)
  let source
  try { source = new WcdbSource({ ...config, key }) }
  catch (error) { store.close(); throw error }
  const sync = new WechatSync({ source, store, accountRoot: config.accountRoot, onError: (error) => console.error('[wechat-coach] 同步失败:', error.message) })
  const api = createApi({ store, sync, llm: ctx.llm, model: config })
  ctx.effect(() => {
    let disposeWeb
    try {
      disposeWeb = registerWebRoutes(ctx.webServer, api)
      sync.start()
    } catch (error) {
      sync.stop(); disposeWeb?.(); source.close(); store.close()
      throw error
    }
    return () => {
      sync.stop()
      disposeWeb(); source.close(); store.close()
    }
  }, 'wechat-coach')
}
