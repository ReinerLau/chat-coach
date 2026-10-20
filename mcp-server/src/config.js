import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'

export const usage = '用法：wechat-mcp stdio --account-root <微信账号目录>'

export function parseConfig(args) {
  const { values } = parseArgs({ args, options: {
    'account-root': { type: 'string' },
    'data-file': { type: 'string' },
    'status-file': { type: 'string' },
    help: { type: 'boolean', short: 'h' }
  } })
  if (values.help) return { help: true }
  if (!values['account-root']?.trim()) throw new Error(usage)
  if (values['data-file'] !== undefined && !values['data-file'].trim()) throw new Error(usage)
  if (values['status-file'] !== undefined && !values['status-file'].trim()) throw new Error(usage)
  const accountRoot = resolve(values['account-root'])
  return {
    accountRoot,
    libraryPath: fileURLToPath(new URL('../vendor/weflow/libWCDB.dylib', import.meta.url))
  }
}
