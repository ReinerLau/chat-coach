#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { launchManager } from '../src/manager/launcher.js'

const usage = '用法：wechat-history [stop] [--no-open]\n打开本机管理页并启动微信 MCP 和隧道；stop 关闭服务与管理后台。'
try {
  const { values, positionals } = parseArgs({ options: { help: { type: 'boolean', short: 'h' }, 'no-open': { type: 'boolean' } }, allowPositionals: true })
  if (values.help) { console.log(usage) }
  else {
    if (positionals.length > 1 || (positionals.length === 1 && positionals[0] !== 'stop')) throw new Error(usage)
    const result = await launchManager({ stop: positionals[0] === 'stop', noOpen: values['no-open'] })
    console.log(result.stopped ? '微信 MCP、隧道和管理后台已关闭。' : `${values['no-open'] ? '管理后台地址' : '管理页已打开'}：${result.origin}`)
    if (result.error) { console.error(result.error); process.exitCode = 1 }
  }
} catch (error) {
  console.error(error.message === usage ? usage : `[wechat-history] ${error.message}`)
  process.exitCode = 1
}
