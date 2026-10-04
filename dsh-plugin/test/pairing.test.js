import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer, request } from 'node:http'
import { createPairingPage, pairingLinks } from '../src/pairing.js'

const interfaces = () => ({
  bridge0: [{ family: 'IPv4', address: '192.168.3.1', internal: false }],
  en0: [{ family: 'IPv4', address: '192.168.0.45', internal: false }],
  lo0: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
  vpn: [{ family: 'IPv4', address: '8.8.8.8', internal: false }]
})

test('pairing link puts the token in a fragment and uses only private LAN addresses', () => {
  assert.deepEqual(pairingLinks(interfaces(), 3085, 'a#b'), [{
    address: '192.168.0.45',
    pageUrl: 'http://192.168.0.45:3085/wechat-coach',
    pairingUrl: 'http://192.168.0.45:3085/wechat-coach#token=a%23b'
  }])
})

test('local setup page shows a QR code but rejects non-loopback Host', async () => {
  const token = 'a'.repeat(48)
  const handler = createPairingPage({ token, port: 3085, host: '0.0.0.0', interfaces })
  const server = createServer(handler)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  try {
    const url = `http://127.0.0.1:${server.address().port}/wechat-coach/setup`
    const local = await fetch(url)
    const html = await local.text()
    assert.equal(local.status, 200)
    assert.equal(local.headers.get('cache-control'), 'no-store')
    assert.match(html, /data:image\/png;base64,/)
    assert.match(html, /192\.168\.0\.45:3085/)
    assert.ok(!html.includes(token))
    const remoteHostStatus = await new Promise((resolve, reject) => {
      const req = request(url, { headers: { Host: '192.168.0.45:3085' } }, (res) => {
        res.resume()
        res.on('end', () => resolve(res.statusCode))
      })
      req.on('error', reject)
      req.end()
    })
    assert.equal(remoteHostStatus, 403)
  } finally {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
})
