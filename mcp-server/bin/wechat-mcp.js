#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { launchManager } from '../src/manager/launcher.js'
import { runForeground } from '../src/manager/foreground.js'

const usage = '用法：wechat-mcp [stop] [--no-open] [--background]\n      wechat-mcp stdio --account-root <微信账号目录> [--data-file <历史缓存 SQLite 文件>] [--status-file <状态文件>]\n打开管理页并在前台等待；Ctrl+C 关闭全部服务。--background 后台启动；stop 关闭全部服务。'
if (process.argv[2] === 'stdio') {
  await import('../src/stdio-cli.js')
} else try {
  const { values, positionals } = parseArgs({ options: { help: { type: 'boolean', short: 'h' }, 'no-open': { type: 'boolean' }, background: { type: 'boolean' } }, allowPositionals: true })
  if (values.help) { console.log(usage) }
  else {
    if (positionals.length > 1 || (positionals.length === 1 && positionals[0] !== 'stop')) throw new Error(usage)
    if (positionals[0] === 'stop' || values.background) {
      const result = await launchManager({ stop: positionals[0] === 'stop', noOpen: values['no-open'] })
      console.log(result.stopped ? '微信历史 MCP、隧道和管理后台已关闭。' : `${values['no-open'] ? '管理后台地址' : '管理页已打开'}：${result.origin}`)
      if (result.error) { console.error(result.error); process.exitCode = 1 }
    } else {
      process.exitCode = await runForeground({ noOpen: values['no-open'] })
    }
  }
} catch (error) {
  console.error(error.message === usage ? usage : `[wechat-mcp] ${error.message}`)
  process.exitCode = 1
}
