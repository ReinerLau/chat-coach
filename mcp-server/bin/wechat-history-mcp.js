#!/usr/bin/env node
import { parseConfig, usage } from '../src/config.js'
import { createHistoryRuntime } from '../src/runtime.js'
import { runServer } from '../src/app.js'

let config
try { config = parseConfig(process.argv.slice(2)) }
catch { console.error(usage); process.exit(2) }
if (config.help) { console.log(usage); process.exit(0) }
if (process.platform !== 'darwin' || process.arch !== 'arm64') {
  console.error('微信数据库读取需要 macOS arm64；Node.js 需要 22.13 或更新版本')
  process.exit(1)
}

try {
  await runServer(createHistoryRuntime(config))
} catch (error) {
  console.error(`[wechat-history-mcp] ${error.message}`)
  process.exitCode = 1
}
