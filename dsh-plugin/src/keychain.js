import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { existsSync, mkdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'

export const KEY_SERVICE = 'chat-coach.wechat-db.v2'
export const TOKEN_SERVICE = 'chat-coach.phone-token'
export const accountName = (root) => resolve(root).toLowerCase()

function helper() {
  const binary = fileURLToPath(new URL('../.native/keychain', import.meta.url))
  const source = fileURLToPath(new URL('../native/keychain.c', import.meta.url))
  if (!existsSync(binary) || statSync(binary).mtimeMs < statSync(source).mtimeMs) {
    mkdirSync(fileURLToPath(new URL('../.native/', import.meta.url)), { recursive: true })
    const result = spawnSync('clang', [source, '-framework', 'Security', '-framework', 'CoreFoundation', '-Wno-deprecated-declarations', '-o', binary], { encoding: 'utf8', maxBuffer: 4096 })
    if (result.status !== 0) throw new Error('无法编译 macOS 钥匙串辅助程序')
  }
  return binary
}

function readSecret(service, account) {
  const result = spawnSync(helper(), ['get', service, account], { encoding: 'utf8', maxBuffer: 4096 })
  return result.status === 0 ? result.stdout.trim() : null
}

function saveSecret(service, account, value) {
  const result = spawnSync(helper(), ['set', service, account], { input: `${value}\n`, encoding: 'utf8', maxBuffer: 4096 })
  if (result.status !== 0) throw new Error('无法保存密钥到 macOS 钥匙串')
}

export function readKey(root) {
  const key = readSecret(KEY_SERVICE, accountName(root))
  return key && /^[a-f0-9]{64}$/i.test(key) ? key : null
}

export function saveKey(root, key) {
  if (!/^[a-f0-9]{64}$/i.test(key)) throw new Error('数据库密钥格式错误')
  saveSecret(KEY_SERVICE, accountName(root), key)
}

export function getPhoneToken() {
  let token = readSecret(TOKEN_SERVICE, 'local')
  if (!token) {
    token = randomBytes(24).toString('hex')
    saveSecret(TOKEN_SERVICE, 'local', token)
  }
  return token
}
