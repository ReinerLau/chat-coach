import { accessSync, constants, existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseYaml } from 'yaml'
import { parse as parseShell, quote } from 'shell-quote'
import { parseConfig } from '../config.js'

export class ManagerError extends Error {}

export function managerPaths(home = homedir(), env = process.env) {
  const root = env.WECHAT_HISTORY_HOME || join(home, '.wechat-history-mcp')
  const profileDir = join(env.XDG_CONFIG_HOME || join(home, '.config'), 'tunnel-client')
  const profileName = existsSync(join(profileDir, 'wechat-history.yaml')) ? 'wechat-history' : 'wechat'
  return { root, profileDir, profileName, profileFile: join(profileDir, `${profileName}.yaml`), stateFile: join(root, 'manager.json'), lockFile: join(root, 'manager.lock'), statusFile: join(root, 'sync-status.json') }
}

export function findTunnelClient(home = homedir(), env = process.env) {
  const candidates = env.TUNNEL_CLIENT_BIN ? [env.TUNNEL_CLIENT_BIN] : [
    ...(env.PATH || '').split(':').filter(Boolean).map((dir) => join(dir, 'tunnel-client')),
    join(home, '.local/share/tunnel-client/v0.0.15/tunnel-client')
  ]
  for (const file of candidates) {
    try { accessSync(file, constants.X_OK); return file } catch {}
  }
  throw new ManagerError('未找到 tunnel-client。请从 OpenAI 官方来源安装，并将命令加入 PATH。')
}

export function loadTunnelConfig(paths, env = process.env) {
  let profile
  try { profile = parseYaml(readFileSync(paths.profileFile, 'utf8'), { logLevel: 'silent', maxAliasCount: 20 }) }
  catch { throw new ManagerError('无法读取微信隧道配置。请按 README 完成 tunnel-client init 配置。') }
  const tunnelId = profile?.control_plane?.tunnel_id
  if (typeof tunnelId !== 'string' || !/^tunnel_[a-f0-9]{32}$/i.test(tunnelId)) throw new ManagerError('隧道 ID 无效，请检查微信隧道配置。')
  const commands = profile?.mcp?.commands
  if (!Array.isArray(commands) || commands.length !== 1 || commands[0].channel !== 'main') throw new ManagerError('管理页只支持一个 main 通道的微信 stdio 服务，请检查隧道配置。')
  let args, config
  try {
    args = parseShell(commands[0].command, () => { throw new Error() })
    if (!args.every((arg) => typeof arg === 'string') || basename(args[0]) !== 'node' || !/^wechat-(?:mcp|history-mcp)(?:\.js)?$/.test(basename(args[1]))) throw new Error()
    const offset = args[2] === 'stdio' && /^wechat-mcp(?:\.js)?$/.test(basename(args[1])) ? 3 : 2
    config = parseConfig(args.slice(offset))
    if (config.help || !isAbsolute(config.accountRoot)) throw new Error()
  } catch { throw new ManagerError('无法识别微信 MCP 启动参数。请使用 README 中的 node + wechat-mcp stdio 启动格式。') }
  const apiKey = profile.control_plane.api_key
  if (typeof apiKey !== 'string' || !/^(?:env:|file:).+/.test(apiKey)) throw new ManagerError('隧道运行密钥必须使用 env: 或 file: 引用；请勿将密钥值写入配置。')
  const baseUrl = profile.control_plane.base_url || 'https://api.openai.com'
  if (typeof baseUrl !== 'string' || !baseUrl.startsWith('https://')) throw new ManagerError('隧道控制地址必须使用 HTTPS。')
  return { ...config, apiKey, tunnelId, baseUrl, logFile: profile.log?.file, statusFile: paths.statusFile }
}

export function validateRuntimeKey(config, env = process.env) {
  if (config.apiKey.startsWith('env:')) {
    if (!env[config.apiKey.slice(4)]) throw new ManagerError('缺少运行密钥环境变量，请在设置该变量的终端启动管理页。')
  } else {
    try { accessSync(config.apiKey.slice(5), constants.R_OK) }
    catch { throw new ManagerError('无法读取隧道运行密钥文件，请恢复配置引用的本机密钥文件。') }
  }
}

export function mcpCommand(config) {
  return quote([
    process.execPath, fileURLToPath(new URL('../../bin/wechat-mcp.js', import.meta.url)),
    'stdio',
    '--account-root', config.accountRoot, '--data-file', config.dataFile, '--status-file', config.statusFile
  ])
}
