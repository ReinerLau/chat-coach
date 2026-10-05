#!/usr/bin/env node
import { saveKey } from '../src/keychain.js'

const accountRoot = process.argv[2]
if (!accountRoot || !process.stdin.isTTY) {
  console.error('用法：node bin/save-db-key.js <微信账号目录>（需在终端交互运行）')
  process.exit(2)
}
process.stdout.write('数据库密钥（输入不回显）：')
process.stdin.setRawMode(true)
process.stdin.resume()
let input = ''
process.stdin.on('data', (chunk) => {
  for (const char of chunk.toString('utf8')) {
    if (char === '\r' || char === '\n') {
      process.stdin.setRawMode(false)
      process.stdin.pause()
      process.stdout.write('\n')
      saveKey(accountRoot, input.trim().replace(/^0x/i, ''))
      input = ''
      console.log('密钥已保存到 chat-coach 钥匙串项。')
      return
    }
    if (char === '\u0003') { process.stdin.setRawMode(false); process.exit(130) }
    if (char === '\u007f') input = input.slice(0, -1)
    else if (input.length < 66) input += char
  }
})
