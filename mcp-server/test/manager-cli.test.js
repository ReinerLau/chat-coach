import test from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyManager } from '../scripts/manager-smoke.js'

test('CLI manages a detached singleton, reports missing config, survives UI stop and cleans shutdown', { timeout: 60000 }, async (t) => {
  const scratch = await mkdtemp(join(tmpdir(), 'wechat-manager-cli-'))
  t.after(() => rm(scratch, { recursive: true, force: true }))
  await verifyManager(fileURLToPath(new URL('../bin/wechat-history.js', import.meta.url)), scratch)
})
