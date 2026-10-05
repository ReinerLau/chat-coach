import { execFile, fork } from 'node:child_process'
import { mkdir, readFile, unlink } from 'node:fs/promises'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { managerPaths, ManagerError } from './config.js'
import { localUrl } from './tunnel.js'

const execute = promisify(execFile)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function isAlive(pid) {
  if (!Number.isInteger(pid) || pid < 1) return false
  try { process.kill(pid, 0); return true } catch { return false }
}

export async function readManager(paths) {
  try {
    const saved = JSON.parse(await readFile(paths.stateFile, 'utf8'))
    if (!isAlive(saved.pid) || localUrl(saved.origin) !== saved.origin || !/^[a-f0-9]{64}$/.test(saved.token)) return null
    const response = await fetch(`${saved.origin}/api/status`, { headers: { 'X-Wechat-Manager-Token': saved.token }, signal: AbortSignal.timeout(35000) })
    return response.ok ? saved : null
  } catch { return null }
}

export async function ensureManager(paths = managerPaths()) {
  const existing = await readManager(paths)
  if (existing) return existing
  await mkdir(paths.root, { recursive: true, mode: 0o700 })
  let owner
  try { owner = Number(await readFile(paths.lockFile, 'utf8')) } catch {}
  if (owner && isAlive(owner)) {
    for (let i = 0; i < 40; i++) {
      const running = await readManager(paths)
      if (running) return running
      await sleep(100)
    }
    throw new ManagerError('管理后台已运行但无法连接，请检查状态后重试。')
  }
  if (owner && !isAlive(owner)) {
    // A missing lock needs no cleanup; another launcher may be acquiring it now.
    try {
      if (Number(await readFile(paths.lockFile, 'utf8')) === owner) await unlink(paths.lockFile)
    } catch (error) { if (error.code !== 'ENOENT') throw new ManagerError('无法清理过期管理状态，请检查用户目录权限。') }
  }
  const child = fork(fileURLToPath(new URL('./daemon.js', import.meta.url)), [], { detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 5000)
    const done = () => { clearTimeout(timer); resolve() }
    child.once('message', done)
    child.once('exit', done)
    child.once('error', done)
  })
  child.unref()
  for (let i = 0; i < 40; i++) {
    const running = await readManager(paths)
    if (running) return running
    await sleep(100)
  }
  throw new ManagerError('管理后台启动失败，请检查 Node.js 版本和用户目录权限。')
}

export async function requestAction(manager, action) {
  const response = await fetch(`${manager.origin}/api/${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: manager.origin, 'X-Wechat-Manager-Token': manager.token }, body: '{}', signal: AbortSignal.timeout(180000)
  })
  const result = await response.json()
  if (!response.ok) throw new ManagerError(result.error || '服务操作失败。')
  return result
}

export async function launchManager({ stop = false, noOpen = false } = {}) {
  const paths = managerPaths()
  let manager = await readManager(paths)
  if (stop && !manager) {
    // Still stop a managed tunnel even if no UI process is active.
    const { TunnelRuntime } = await import('./tunnel.js')
    await new TunnelRuntime(paths).action('stop')
    return { stopped: true }
  }
  if (!manager) manager = await ensureManager(paths)
  if (stop) {
    await requestAction(manager, 'shutdown')
    for (let i = 0; i < 400; i++) {
      if (!isAlive(manager.pid)) return { stopped: true }
      await sleep(100)
    }
    throw new ManagerError('服务已停止，但管理后台尚未退出，请检查状态后重试。')
  }
  let error
  try { await requestAction(manager, 'start') }
  catch (failure) { error = failure.message }
  if (!noOpen) {
    try { await execute('open', [`${manager.origin}/#${manager.token}`], { timeout: 5000 }) }
    catch { throw new ManagerError('无法打开浏览器，请重试 wechat-history，或使用 --no-open 检查后台。') }
  }
  return { origin: manager.origin, error }
}
