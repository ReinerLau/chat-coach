#!/usr/bin/env node
import { createHash, createDecipheriv, pbkdf2Sync } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { saveKey } from '../src/keychain.js'

const accountRoot = process.argv[2]
if (!accountRoot) { console.error('用法：node bin/import-tracememo-key.js <微信账号目录>'); process.exit(2) }
const root = resolve(accountRoot)
const id = createHash('sha256').update(root.toLowerCase()).digest('hex')
const file = join(homedir(), 'Library/Application Support/TraceMemo/database-keys', `${id}.bin`)
const encrypted = readFileSync(file)
if (encrypted.subarray(0, 3).toString() !== 'v10') throw new Error('不支持当前密钥加密格式')
const password = spawnSync('security', ['find-generic-password', '-s', 'TraceMemo Safe Storage', '-a', 'TraceMemo Key', '-w'], { encoding: 'utf8', maxBuffer: 4096 })
if (password.status !== 0) throw new Error('无法读取 TraceMemo 的 macOS 钥匙串项')
const aesKey = pbkdf2Sync(password.stdout.trim(), 'saltysalt', 1003, 16, 'sha1')
const decipher = createDecipheriv('aes-128-cbc', aesKey, Buffer.alloc(16, 0x20))
const key = Buffer.concat([decipher.update(encrypted.subarray(3)), decipher.final()]).toString('utf8').trim().replace(/^0x/i, '')
if (!/^[a-f0-9]{64}$/i.test(key)) throw new Error('解密结果不是有效的微信数据库密钥')
saveKey(root, key)
console.log('密钥已导入 chat-coach 钥匙串项；运行 MCP 不再读取 TraceMemo 数据。')
