import { randomBytes, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { PreviewError } from './preview.js'

const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/icon.svg', ['icon.svg', 'image/svg+xml']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/preview.js', ['preview.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']]
])

function equalToken(actual, expected) {
  return typeof actual === 'string' && /^[a-f0-9]{64}$/.test(actual) && actual.length === expected.length && timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
}

export async function createManagerServer(controller, { preview, onShutdown = () => {}, token = randomBytes(32).toString('hex') } = {}) {
  let origin
  let shuttingDown = false
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
    const json = (status, body) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify(body))
    }
    if (request.headers.host !== new URL(origin).host) return json(403, { error: '仅允许本机管理页面访问。' })
    let url
    try { url = new URL(request.url, origin) }
    catch { return json(400, { error: '请求地址无效。' }) }
    const path = url.pathname
    if (request.method === 'GET' && assets.has(path)) {
      const [file, type] = assets.get(path)
      try {
        const body = await readFile(fileURLToPath(new URL(`../../web/${file}`, import.meta.url)))
        response.writeHead(200, { 'Content-Type': type })
        response.end(body)
      } catch { json(500, { error: '管理页面资源缺失，请重新安装 npm 包。' }) }
      return
    }
    if (!equalToken(request.headers['x-wechat-manager-token'], token)) return json(403, { error: '页面会话无效，请重新运行 wechat-mcp 打开管理页。' })
    if (request.headers.origin && request.headers.origin !== origin) return json(403, { error: '拒绝跨站访问。' })
    if (request.headers['sec-fetch-site'] === 'cross-site') return json(403, { error: '拒绝跨站访问。' })
    const previewKind = /^\/api\/preview\/(sessions|history)$/.exec(path)?.[1]
    if (request.method === 'GET' && previewKind) {
      if (!preview) return json(503, { error: '缓存预览暂不可用，请重新运行 wechat-mcp。' })
      try { return json(200, preview.read(previewKind, url.searchParams)) }
      catch (error) {
        return json(error instanceof PreviewError ? error.status : 503, { error: error instanceof PreviewError ? error.message : '无法读取历史缓存数据，请稍后重试。' })
      }
    }
    if (request.method === 'GET' && path === '/api/status') {
      try { return json(200, await controller.snapshot()) }
      catch { return json(503, { error: '无法读取服务状态，请重试。' }) }
    }
    const action = /^\/api\/(start|stop|restart|shutdown)$/.exec(path || '')?.[1]
    if (request.method !== 'POST' || !action) return json(404, { error: '操作不存在。' })
    if (request.headers.origin !== origin || request.headers['content-type'] !== 'application/json' || request.headers['sec-fetch-site'] === 'cross-site') return json(403, { error: '拒绝跨站管理操作。' })
    let length = 0
    let body = ''
    try {
      for await (const chunk of request) {
        length += chunk.length
        if (length > 1024) return json(413, { error: '请求过大。' })
        body += chunk
      }
      if (body !== '{}' && body !== '') return json(400, { error: '管理操作不接受额外参数。' })
      if (shuttingDown) return json(409, { error: '管理后台正在关闭。' })
      if (action === 'shutdown') shuttingDown = true
      const snapshot = await controller.action(action === 'shutdown' ? 'stop' : action)
      json(200, snapshot)
      if (action === 'shutdown') setImmediate(() => {
        server.close(onShutdown)
        // Browser preconnect sockets may never send a request; close them as well.
        server.closeAllConnections()
      })
    } catch {
      if (action === 'shutdown') shuttingDown = false
      let error = '操作未完成，请查看服务状态。'
      try { error = (await controller.snapshot()).error || error } catch {}
      json(409, { error })
    }
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  origin = `http://127.0.0.1:${server.address().port}`
  return { server, origin, token, url: `${origin}/#${token}` }
}
