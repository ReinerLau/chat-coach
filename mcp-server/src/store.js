import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

export class MessageStore {
  constructor(file, { readOnly = false } = {}) {
    if (readOnly) {
      this.db = new DatabaseSync(file, { readOnly: true })
      return
    }
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
    this.db = new DatabaseSync(file)
    this.db.exec(`PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, updated_at INTEGER NOT NULL DEFAULT 0,
        history_complete INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS messages (
        session_id TEXT NOT NULL, local_id TEXT NOT NULL, server_id TEXT NOT NULL,
        created_at INTEGER NOT NULL, type INTEGER NOT NULL, is_self INTEGER NOT NULL,
        content TEXT NOT NULL, sender_id TEXT NOT NULL,
        PRIMARY KEY (session_id, local_id)
      );
      CREATE INDEX IF NOT EXISTS messages_order ON messages(session_id, created_at DESC, local_id DESC);`)
    if (!this.db.prepare('PRAGMA table_info(sessions)').all().some((column) => column.name === 'history_complete')) {
      this.db.exec('ALTER TABLE sessions ADD COLUMN history_complete INTEGER NOT NULL DEFAULT 0')
    }
    this.upsertSession = this.db.prepare('INSERT INTO sessions(id,name,updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, updated_at=MAX(updated_at,excluded.updated_at)')
    this.upsertMessage = this.db.prepare('INSERT OR IGNORE INTO messages(session_id,local_id,server_id,created_at,type,is_self,content,sender_id) VALUES(?,?,?,?,?,?,?,?)')
  }

  saveSession(session, updatedAt = 0) {
    this.upsertSession.run(session.id, session.name, updatedAt)
  }

  saveMessages(messages) {
    let inserted = 0
    this.db.exec('BEGIN')
    try {
      for (const message of messages) {
        const result = this.upsertMessage.run(message.sessionId, message.localId, message.serverId, message.createdAt, message.type, message.isSelf ? 1 : 0, message.content, message.senderId)
        inserted += Number(result.changes)
      }
      this.db.exec('COMMIT')
    } catch (error) {
      this.db.exec('ROLLBACK')
      throw error
    }
    return inserted
  }

  hasMessage(sessionId, localId) {
    return Boolean(this.db.prepare('SELECT 1 FROM messages WHERE session_id=? AND local_id=?').get(sessionId, localId))
  }

  isHistoryComplete(sessionId) {
    return Boolean(this.db.prepare('SELECT history_complete FROM sessions WHERE id=?').get(sessionId)?.history_complete)
  }

  latestTime(sessionId) {
    return this.db.prepare('SELECT MAX(created_at) AS time FROM messages WHERE session_id=?').get(sessionId)?.time ?? 0
  }

  stats() {
    return {
      sessions: this.db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,
      messages: this.db.prepare('SELECT COUNT(*) AS n FROM messages').get().n
    }
  }

  markHistoryComplete(sessionId) {
    this.db.prepare('UPDATE sessions SET history_complete=1 WHERE id=?').run(sessionId)
  }

  sessions({ query = '', limit = 50, offset = 0 } = {}) {
    return this.db.prepare(`SELECT id,name,updated_at AS updatedAt FROM sessions
      WHERE instr(lower(name),lower(?)) > 0 OR instr(lower(id),lower(?)) > 0
      ORDER BY updated_at DESC,id ASC LIMIT ? OFFSET ?`).all(query, query, limit, offset).map((row) => ({ ...row }))
  }

  session(id) {
    const row = this.db.prepare('SELECT id,name,updated_at AS updatedAt FROM sessions WHERE id=?').get(id)
    return row ? { ...row } : undefined
  }

  messages(sessionId, limit = 50, before = null) {
    const sql = `SELECT session_id AS sessionId, local_id AS localId, server_id AS serverId,
      created_at AS createdAt, type, is_self AS isSelf, content, sender_id AS senderId
      FROM messages WHERE session_id=? ${before ? 'AND (created_at < ? OR (created_at = ? AND local_id < ?))' : ''}
      ORDER BY created_at DESC, local_id DESC LIMIT ?`
    const args = before ? [sessionId, before.createdAt, before.createdAt, before.localId, limit] : [sessionId, limit]
    return this.db.prepare(sql).all(...args).reverse().map((row) => ({ ...row, isSelf: Boolean(row.isSelf) }))
  }

  close() { this.db.close() }
}
