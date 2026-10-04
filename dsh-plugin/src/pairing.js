import { networkInterfaces } from 'node:os'
import QRCode from 'qrcode'

function privateIpv4(address) {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false
  return parts[0] === 10 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168)
}

export function pairingLinks(interfaces, port, token) {
  const candidates = []
  for (const [name, entries] of Object.entries(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal && privateIpv4(entry.address)) candidates.push({ name, address: entry.address })
    }
  }
  const preferred = candidates.filter(({ name }) => /^en\d+$/.test(name))
  const addresses = new Set((preferred.length ? preferred : candidates).map(({ address }) => address))
  return [...addresses].map((address) => ({
    address,
    pageUrl: `http://${address}:${port}/wechat-coach`,
    pairingUrl: `http://${address}:${port}/wechat-coach#token=${encodeURIComponent(token)}`
  }))
}

export function isLocalSetupRequest(request) {
  const address = request.socket.remoteAddress
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address)) return false
  try { return ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(`http://${request.headers.host}`).hostname) }
  catch { return false }
}

export function createPairingPage({ token, port, host, interfaces = networkInterfaces }) {
  return async (request, response) => {
    if (!isLocalSetupRequest(request)) { response.writeHead(403); response.end(); return }
    if (request.method !== 'GET') { response.writeHead(405); response.end(); return }
    const links = host === '0.0.0.0' ? pairingLinks(interfaces(), port, token) : []
    let cards
    try {
      cards = await Promise.all(links.map(async ({ pageUrl, pairingUrl }) => {
        const qr = await QRCode.toDataURL(pairingUrl, { errorCorrectionLevel: 'M', margin: 1, width: 240 })
        return `<section><img src="${qr}" width="240" height="240" alt="手机配对二维码"><p>${pageUrl}</p></section>`
      }))
    } catch {
      response.writeHead(500); response.end(); return
    }
    const content = cards.length ? cards.join('') : '<p>没有可用的局域网地址；请检查网络及插件的 lanHost 配置。</p>'
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
    })
    response.end(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>微信回复教练配对</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;max-width:760px;margin:32px auto;padding:0 20px;color:#17212b}section{display:inline-block;text-align:center;margin:12px;padding:16px;border:1px solid #e5e8eb;border-radius:12px}img{display:block}p{overflow-wrap:anywhere}</style></head><body><h1>微信回复教练</h1><p>用同一局域网中的手机扫描二维码，自动连接。二维码包含访问凭证，请勿分享截图。</p>${content}</body></html>`)
  }
}
