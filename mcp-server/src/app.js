import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createMcpServer } from './server.js'

export async function runServer(runtime) {
  const server = createMcpServer(runtime.history)
  let closing
  function shutdown(code = 0) {
    if (!closing) closing = (async () => {
      process.exitCode = code
      try { await runtime.close() }
      catch { console.error('[wechat-mcp] 关闭数据库失败'); process.exitCode = 1 }
      finally {
        await server.close()
        process.stdin.pause()
        process.off('SIGINT', onInterrupt)
        process.off('SIGTERM', onTerminate)
        process.stdin.off('end', onEnd)
      }
    })()
    return closing
  }
  const onInterrupt = () => { void shutdown(130) }
  const onTerminate = () => { void shutdown() }
  const onEnd = () => { void shutdown() }
  process.once('SIGINT', onInterrupt)
  process.once('SIGTERM', onTerminate)
  process.stdin.once('end', onEnd)
  server.server.onclose = onEnd
  server.server.onerror = () => console.error('[wechat-mcp] MCP 通信错误')
  try {
    await server.connect(new StdioServerTransport())
    runtime.start()
  } catch {
    await shutdown(1)
    throw new Error('服务启动失败，请检查本机配置')
  }
  return shutdown
}
