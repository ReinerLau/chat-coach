import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import z from '@deepseek-ai/schemastery'
import { MessageStore } from './store.js'
import { WcdbSource } from './wcdb.js'
import { WechatSync } from './sync.js'
import { createApi } from './http.js'
import { getPhoneToken, readKey } from './keychain.js'
import { createPairingPage } from './pairing.js'

export const name = 'wechat-coach'
export const inject = ['webServer', 'llm']
export const Config = z.object({
  accountRoot: z.string().required(),
  libraryPath: z.string().default(fileURLToPath(new URL('../vendor/weflow/libWCDB.dylib', import.meta.url))),
  dataFile: z.string().required(),
  lanHost: z.string().default('127.0.0.1'),
  lanPort: z.number().step(1).min(1).max(65535).default(3085),
  keyEnv: z.string().default('WECHAT_DB_KEY'),
  tokenEnv: z.string().default('WECHAT_COACH_TOKEN'),
  provider: z.string().required(),
  model: z.string().required()
})

export function apply(ctx, config) {
  if (!['127.0.0.1', '0.0.0.0'].includes(config.lanHost)) throw new Error('lanHost 仅支持 127.0.0.1 或 0.0.0.0')
  const key = process.env[config.keyEnv] || readKey(config.accountRoot)
  const token = process.env[config.tokenEnv] || getPhoneToken()
  if (!key || !token || token.length < 24) throw new Error('缺少微信数据库密钥或手机访问令牌')
  const store = new MessageStore(config.dataFile)
  let source
  try { source = new WcdbSource({ ...config, key }) }
  catch (error) { store.close(); throw error }
  const sync = new WechatSync({ source, store, accountRoot: config.accountRoot, onError: (error) => console.error('[wechat-coach] 同步失败:', error.message) })
  const api = createApi({ store, sync, llm: ctx.llm, token, model: config })
  const setup = createPairingPage({ token, port: config.lanPort, host: config.lanHost })
  const html = readFileSync(fileURLToPath(new URL('./mobile.html', import.meta.url)))
  const page = (req, res) => {
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'" })
    res.end(html)
  }
  ctx.effect(async () => {
    const disposeApi = ctx.webServer.register({ kind: 'prefix', path: '/wechat-coach/api', handler: api })
    const disposePage = ctx.webServer.register({ kind: 'exact', path: '/wechat-coach', handler: page })
    const disposeSetup = ctx.webServer.register({ kind: 'exact', path: '/wechat-coach/setup', handler: setup })
    const lanServer = createServer((req, res) => {
      const pathname = new URL(req.url, 'http://localhost').pathname
      if (pathname === '/wechat-coach') return page(req, res)
      if (pathname === '/wechat-coach/setup') return setup(req, res)
      if (pathname === '/wechat-coach/api' || pathname.startsWith('/wechat-coach/api/')) return api(req, res)
      res.writeHead(404); res.end()
    })
    try {
      await new Promise((resolve, reject) => {
        lanServer.once('error', reject)
        lanServer.listen(config.lanPort, config.lanHost, () => { lanServer.off('error', reject); resolve() })
      })
      sync.start()
    } catch (error) {
      disposeSetup(); disposePage(); disposeApi(); source.close(); store.close()
      throw error
    }
    return async () => {
      sync.stop()
      await new Promise((resolve) => lanServer.close(resolve))
      disposeSetup(); disposePage(); disposeApi(); source.close(); store.close()
    }
  }, 'wechat-coach')
}
