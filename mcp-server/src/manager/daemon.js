import { open, unlink, writeFile } from 'node:fs/promises'
import { managerPaths } from './config.js'
import { TunnelRuntime } from './tunnel.js'
import { createManagerServer } from './server.js'
import { CachePreview } from './preview.js'

const paths = managerPaths()
let lock
let managed
let cleaning

async function cleanup() {
  if (cleaning) return cleaning
  cleaning = (async () => {
    if (managed) await new Promise((resolve) => {
      managed.server.close(resolve)
      managed.server.closeAllConnections()
    })
    await lock?.close()
    for (const file of [paths.stateFile, paths.lockFile]) {
      try { await unlink(file) } catch {}
    }
  })()
  return cleaning
}

try {
  // The launcher owns directory creation; O_EXCL prevents concurrent manager processes.
  lock = await open(paths.lockFile, 'wx', 0o600)
  await lock.writeFile(String(process.pid))
  const controller = new TunnelRuntime(paths)
  managed = await createManagerServer(controller, { preview: new CachePreview(paths), onShutdown: () => { void cleanup() } })
  await writeFile(paths.stateFile, JSON.stringify({ pid: process.pid, origin: managed.origin, token: managed.token }), { mode: 0o600 })
  process.send?.({ ready: true })
  process.disconnect?.()
  const onSignal = () => { void cleanup() }
  process.once('SIGTERM', onSignal)
  process.once('SIGINT', onSignal)
} catch {
  // Never remove another process's lock or state on an unsuccessful acquisition.
  if (lock) await cleanup()
  process.send?.({ ready: false })
  process.disconnect?.()
  process.exitCode = 1
}
