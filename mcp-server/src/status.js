import { randomUUID } from 'node:crypto'
import { mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export function createStatusReporter(file, store, onError = () => {}) {
  if (!file) return { update() {} }
  const state = { version: 1, pid: process.pid, instanceId: randomUUID(), startedAt: new Date().toISOString(), phase: 'starting', lastSuccessAt: null, error: null }
  let writtenAt = 0
  let writeFailed = false
  return {
    update(change) {
      const samePhase = change.phase === state.phase
      Object.assign(state, change)
      if (samePhase && change.phase === 'syncing' && Date.now() - writtenAt < 1000) return
      try {
        mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
        const snapshot = { ...state, ...store.stats(), updatedAt: new Date().toISOString() }
        const temporary = `${file}.${process.pid}.tmp`
        writeFileSync(temporary, JSON.stringify(snapshot), { mode: 0o600 })
        renameSync(temporary, file)
        writtenAt = Date.now()
        writeFailed = false
      } catch {
        if (!writeFailed) onError()
        writeFailed = true
      }
    }
  }
}
