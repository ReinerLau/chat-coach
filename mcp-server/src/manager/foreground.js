import { isAlive, launchManager, stopManager } from './launcher.js'

export async function runForeground({
  noOpen = false, launch = launchManager, stop = stopManager, isRunning = isAlive,
  signals = process, log = console.log, report = console.error, pollMs = 500
} = {}) {
  let manager, reason, shutdownAttempted = false
  let wake
  const interrupted = new Promise((resolve) => { wake = resolve })
  const finish = (next) => { if (!reason) { reason = next; wake(next) } }
  const onInterrupt = () => finish('SIGINT')
  const onTerminate = () => finish('SIGTERM')
  signals.on('SIGINT', onInterrupt)
  signals.on('SIGTERM', onTerminate)
  // A pending Promise alone cannot keep Node alive. Also observe external shutdown.
  const monitor = setInterval(() => {
    if (manager && !isRunning(manager.pid)) finish('closed')
  }, pollMs)
  const close = async () => {
    shutdownAttempted = true
    log('正在关闭微信 MCP、隧道和管理后台，请稍候。')
    await stop(manager)
    log('微信 MCP、隧道和管理后台已关闭。')
  }
  try {
    const result = await launch({ noOpen, onReady: (ready) => { manager = ready } })
    log(`${noOpen ? '管理后台地址' : '管理页已打开'}：${result.origin}`)
    if (result.error) report(result.error)
    if (!reason) log('按 Ctrl+C 关闭微信 MCP、隧道和管理后台。')
    const event = await interrupted
    if (event === 'closed') { log('管理后台已退出，终端命令结束。'); return 0 }
    await close()
    return event === 'SIGINT' ? 130 : 143
  } catch (error) {
    // Startup can fail after acquiring the manager (for example, opening a browser).
    if (!shutdownAttempted && manager) {
      try { await close() }
      catch { throw new Error('启动未完成且无法关闭服务，请运行 wechat-history stop 重试。') }
      if (reason === 'SIGINT' || reason === 'SIGTERM') return reason === 'SIGINT' ? 130 : 143
      throw error
    }
    if (shutdownAttempted) throw new Error('关闭服务失败，请运行 wechat-history stop 重试。')
    throw error
  } finally {
    clearInterval(monitor)
    signals.off('SIGINT', onInterrupt)
    signals.off('SIGTERM', onTerminate)
  }
}
