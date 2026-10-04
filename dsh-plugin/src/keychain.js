import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const KEY_SERVICE = 'chat-coach.wechat-db.v2'
export const accountName = (root) => resolve(root).toLowerCase()
export const keychainHelperPath = (home = homedir()) => join(home, '.dsh', 'wechat-coach', 'native', 'keychain')

function helper() {
  const binary = keychainHelperPath()
  const source = fileURLToPath(new URL('../native/keychain.c', import.meta.url))
  const digest = createHash('sha256').update(readFileSync(source)).digest('hex')
  const marker = `${binary}.sha256`
  if (!existsSync(binary) || !existsSync(marker) || readFileSync(marker, 'utf8') !== digest) {
    mkdirSync(dirname(binary), { recursive: true, mode: 0o700 })
    const result = spawnSync('clang', [source, '-framework', 'Security', '-framework', 'CoreFoundation', '-Wno-deprecated-declarations', '-o', binary], { encoding: 'utf8', maxBuffer: 4096 })
    if (result.status !== 0) throw new Error('无法编译 macOS 钥匙串辅助程序')
    writeFileSync(marker, digest, { mode: 0o600 })
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
