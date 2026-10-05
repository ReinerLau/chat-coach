import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { open, readFile } from 'node:fs/promises'
import { ManagerError, findTunnelClient, loadTunnelConfig, mcpCommand, validateRuntimeKey } from './config.js'

const execute = promisify(execFile)
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export function localUrl(value) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.port || url.username || url.password) return null
    return url.origin
  } catch { return null }
}

function alive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false
  try { process.kill(pid, 0); return true } catch { return false }
}

// Only retained log fields are displayed: arbitrary payloads and CLI stderr never reach the UI.
export async function safeLogs(file) {
  if (typeof file !== 'string') return []
  let handle
  try {
    handle = await open(file, 'r')
    const { size } = await handle.stat()
    const buffer = Buffer.alloc(Math.min(size, 128 * 1024))
    await handle.read(buffer, 0, buffer.length, Math.max(0, size - buffer.length))
    return buffer.toString('utf8').split('\n').flatMap((line) => {
      try {
        const row = JSON.parse(line)
        const known = new Map([
          ['stdio MCP command started', '微信 MCP 进程已启动'],
          ['tunnel metadata fetched', '已获取隧道信息'],
          ['🟢 tunnel-client started', '隧道客户端已启动'],
          ['dispatcher forwarded command to MCP server', '已将请求交给 MCP 服务'],
          ['dispatcher acknowledged notification with control plane', '已确认隧道通知']
        ])
        const message = known.get(row.msg) || (row.level === 'ERROR' ? '隧道客户端报告错误，请检查隧道权限、网络或重启服务。' : row.level === 'WARN' ? '隧道客户端记录了警告事件，可在官方诊断页查看状态。' : null)
        if (!message) return []
        const time = typeof row.time === 'string' && Number.isFinite(Date.parse(row.time)) ? new Date(row.time).toISOString() : ''
        return [{ time, level: ['INFO', 'WARN', 'ERROR', 'DEBUG'].includes(row.level) ? row.level : 'INFO', message }]
      } catch {
        if (line.startsWith('[wechat-mcp]') || line.startsWith('[wechat-history-mcp]')) return [{ time: '', level: 'ERROR', message: '微信 MCP 报告错误，请检查账号配置或重启服务。' }]
        return []
      }
    }).slice(-100)
  } catch { return [] }
  finally { await handle?.close() }
}

export class TunnelRuntime {
  constructor(paths, { home, env = process.env, run = execute, sleep = delay, isAlive = alive } = {}) {
    this.paths = paths
    this.env = env
    this.home = home
    this.run = run
    this.sleep = sleep
    this.isAlive = isAlive
    this.operation = null
    this.lastError = null
    this.queue = Promise.resolve()
  }

  async client(args, timeout = 30000) {
    const executable = findTunnelClient(this.home, this.env)
    try {
      const { stdout } = await this.run(executable, args, { env: this.env, timeout, maxBuffer: 4 * 1024 * 1024, killSignal: 'SIGTERM' })
      return stdout
    } catch (error) {
      if (['status', 'stop'].includes(args[1]) && /^alias (?:wechat|wechat-history) is not known; run create or connect first\s*$/.test(error.stderr || '')) {
        throw Object.assign(new ManagerError('尚未创建本机隧道运行实例。'), { code: 'RUNTIME_NOT_FOUND' })
      }
      if (error.killed || error.code === 'ETIMEDOUT') throw new ManagerError('隧道操作超时，请查看诊断状态后重试。')
      throw new ManagerError('tunnel-client 操作失败，请检查配置、密钥和隧道权限。')
    }
  }

  async rawStatus(timeout) {
    let output
    try { output = await this.client(['runtimes', 'status', this.paths.profileName, '--json'], timeout) }
    catch (error) {
      if (error.code === 'RUNTIME_NOT_FOUND') return { process_running: false, healthy: false, ready: false }
      throw error
    }
    try { return JSON.parse(output) }
    catch { throw new ManagerError('无法解析 tunnel-client 状态，请检查客户端版本。') }
  }

  async syncState(running, startedAt) {
    try {
      const saved = JSON.parse(await readFile(this.paths.statusFile, 'utf8'))
      const recentInstance = !startedAt || Date.parse(saved.startedAt) >= Date.parse(startedAt) - 1000
      const current = running && recentInstance && this.isAlive(saved.pid) && ['starting', 'syncing', 'idle', 'error'].includes(saved.phase)
      return {
        phase: current ? saved.phase : (running ? 'unavailable' : 'stopped'), stale: !current,
        lastSuccessAt: typeof saved.lastSuccessAt === 'string' ? saved.lastSuccessAt : null,
        sessions: Number.isSafeInteger(saved.sessions) && saved.sessions >= 0 ? saved.sessions : null,
        messages: Number.isSafeInteger(saved.messages) && saved.messages >= 0 ? saved.messages : null,
        error: current && saved.error ? '微信同步或数据库监听失败，请检查账号目录和数据库密钥。' : null
      }
    } catch { return { phase: running ? 'unavailable' : 'stopped', stale: true, lastSuccessAt: null, sessions: null, messages: null, error: null } }
  }

  async snapshot() {
    try {
      const config = loadTunnelConfig(this.paths, this.env)
      const raw = await this.rawStatus()
      const running = Boolean(raw.process_running)
      const healthy = Boolean(raw.healthy)
      const ready = Boolean(raw.ready)
      const sync = await this.syncState(running, raw.process?.started_at)
      const health = await this.mcpHealth(raw)
      const uiUrl = localUrl(raw.ui_url)
      const mcp = running ? (health === 'running' ? 'running' : health === 'stopped' ? 'error' : 'unknown') : 'stopped'
      const state = this.operation || (this.lastError || sync.error || (running && (!healthy || !ready || health !== 'running')) ? 'error' : running ? 'running' : 'stopped')
      return { state, operation: this.operation, error: this.lastError || sync.error || (running && health !== 'running' ? '微信 MCP 未运行或无法确认，请检查数据库密钥和客户端诊断。' : running && !ready ? '服务已启动但尚未就绪，请检查诊断日志。' : null), mcp, tunnel: running ? (healthy && ready ? 'connected' : 'starting') : 'stopped', sync, diagnosticsUrl: uiUrl ? `${uiUrl}/ui` : null, logs: await safeLogs(config.logFile) }
    } catch (error) {
      return { state: this.operation || 'error', operation: this.operation, error: error instanceof ManagerError ? error.message : '无法读取服务状态，请检查本机配置。', mcp: 'unknown', tunnel: 'unknown', sync: await this.syncState(false), diagnosticsUrl: null, logs: [] }
    }
  }

  async mcpHealth(raw) {
    if (!raw.process_running) return 'stopped'
    const origin = localUrl(raw.mcp_health_url || raw.health_url)
    if (!origin) return 'unknown'
    try {
      const response = await fetch(`${origin}/health/mcp`, { signal: AbortSignal.timeout(2000) })
      if (!response.ok) return 'unknown'
      const data = await response.json()
      return data.details?.child_state === 'running' ? 'running' : 'stopped'
    } catch { return 'unknown' }
  }

  action(action) {
    if (!['start', 'stop', 'restart'].includes(action)) return Promise.reject(new ManagerError('不支持的管理操作。'))
    const next = this.queue.catch(() => {}).then(async () => {
      this.operation = { start: 'starting', stop: 'stopping', restart: 'restarting' }[action]
      this.lastError = null
      try {
        if (action !== 'start') await this.stop()
        if (action !== 'stop') await this.start()
      } catch (error) {
        this.lastError = error instanceof ManagerError ? error.message : '服务操作失败，请检查本机配置。'
        throw new ManagerError(this.lastError)
      } finally { this.operation = null }
      return this.snapshot()
    })
    this.queue = next
    return next
  }

  async stop() {
    try { await this.client(['runtimes', 'stop', this.paths.profileName]) }
    catch (error) { if (error.code !== 'RUNTIME_NOT_FOUND') throw error }
    const status = await this.rawStatus()
    if (status.process_running || status.healthy || status.ready) throw new ManagerError('旧服务尚未停止，已取消后续启动，避免同一隧道运行多个实例。')
  }

  async start() {
    const config = loadTunnelConfig(this.paths, this.env)
    validateRuntimeKey(config, this.env)
    const previous = await this.rawStatus()
    if (previous.process_running && previous.healthy && previous.ready && await this.mcpHealth(previous) === 'running') return
    if (previous.process_running || previous.healthy || previous.ready) await this.stop()
    await this.client([
      'runtimes', 'connect', '--alias', this.paths.profileName, '--profile', this.paths.profileName,
      '--profile-dir', this.paths.profileDir, '--tunnel-id', config.tunnelId,
      '--runtime-api-key', config.apiKey, '--control-plane-base-url', config.baseUrl, '--mcp-command', mcpCommand(config)
    ])
    const deadline = Date.now() + 30000
    for (let i = 0; i < 30 && Date.now() < deadline; i++) {
      const status = await this.rawStatus(Math.max(1, deadline - Date.now()))
      if (status.process_running && status.healthy && status.ready && await this.mcpHealth(status) === 'running') return
      if (!status.process_running) break
      await this.sleep(500)
    }
    throw new ManagerError('MCP 或隧道未就绪，请检查微信密钥、客户端版本和隧道权限后重试。')
  }
}
