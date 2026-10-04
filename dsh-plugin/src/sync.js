import { watch } from 'node:fs'
import { join } from 'node:path'
import { normalizeMessage, normalizeSession } from './normalize.js'

export class WechatSync {
  constructor({ source, store, accountRoot, onError = () => {}, pageSize = 200 }) {
    this.source = source
    this.store = store
    this.accountRoot = accountRoot
    this.onError = onError
    this.pageSize = pageSize
    this.inFlight = null
    this.dirty = false
    this.watcher = null
    this.timer = null
  }

  sync() {
    if (this.inFlight) { this.dirty = true; return this.inFlight }
    this.inFlight = this.run().finally(() => { this.inFlight = null })
    return this.inFlight
  }

  async run() {
    do {
        this.dirty = false
        for (const raw of this.source.sessions()) {
          const session = normalizeSession(raw)
          if (!session) continue
          const historyComplete = this.store.isHistoryComplete?.(session.id) ?? true
          const cutoff = Math.max(0, (this.store.latestTime?.(session.id) ?? 0) - 30)
          let latest = 0
          const pages = this.source.messagePages ? this.source.messagePages(session.id, this.pageSize) : this.legacyPages(session.id)
          for (const rows of pages) {
            if (!Array.isArray(rows)) throw new Error('WCDB 消息结果不是数组')
            let reachedKnown = false
            const pending = []
            for (const row of rows) {
              const message = normalizeMessage(row, session.id)
              if (!message) continue
              if (this.store.hasMessage(session.id, message.localId)) {
                if (historyComplete && message.createdAt < cutoff) { reachedKnown = true; break }
                continue
              }
              pending.push(message)
              latest = Math.max(latest, message.createdAt)
            }
            this.store.saveMessages(pending)
            if (reachedKnown) break
          }
          this.store.saveSession(session, latest)
          this.store.markHistoryComplete?.(session.id)
        }
    } while (this.dirty)
  }

  *legacyPages(sessionId) {
    let offset = 0
    while (true) {
      const rows = this.source.messages(sessionId, this.pageSize, offset)
      if (!rows.length) return
      yield rows
      if (rows.length < this.pageSize) return
      offset += rows.length
    }
  }

  start() {
    const path = join(this.accountRoot, 'db_storage')
    this.watcher = watch(path, { recursive: true }, (_event, file) => {
      if (file && !/\.db(?:-(?:wal|shm))?$/i.test(file)) return
      clearTimeout(this.timer)
      this.timer = setTimeout(() => this.sync().catch(this.onError), 350)
    })
    this.sync().catch(this.onError)
  }

  stop() { clearTimeout(this.timer); this.watcher?.close(); this.watcher = null }
}
