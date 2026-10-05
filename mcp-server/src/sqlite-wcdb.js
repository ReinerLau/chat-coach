import { existsSync } from 'node:fs'
import koffi from 'koffi'

export class SqliteWcdb {
  constructor(libraryPath, key) {
    if (!/^(?:0x)?[a-f0-9]{64}$/i.test(key ?? '')) throw new Error('微信数据库密钥须为 64 位十六进制')
    if (!existsSync(libraryPath)) throw new Error(`找不到 WCDB 库：${libraryPath}`)
    this.key = Buffer.from(key.replace(/^0x/i, ''), 'hex')
    this.lib = koffi.load(libraryPath)
    this.openFn = this.lib.func('int sqlite3_open_v2(const char* path,_Out_ void** db,int flags,const char* vfs)')
    this.keyFn = this.lib.func('int sqlite3_key(void* db,const void* key,int nkey)')
    this.prepareFn = this.lib.func('int sqlite3_prepare_v2(void* db,const char* sql,int nbytes,_Out_ void** stmt,const char** tail)')
    this.stepFn = this.lib.func('int sqlite3_step(void* stmt)')
    this.finalizeFn = this.lib.func('int sqlite3_finalize(void* stmt)')
    this.closeFn = this.lib.func('int sqlite3_close(void* db)')
    this.countFn = this.lib.func('int sqlite3_column_count(void* stmt)')
    this.nameFn = this.lib.func('const char* sqlite3_column_name(void* stmt,int i)')
    this.typeFn = this.lib.func('int sqlite3_column_type(void* stmt,int i)')
    this.intFn = this.lib.func('int64 sqlite3_column_int64(void* stmt,int i)')
    this.doubleFn = this.lib.func('double sqlite3_column_double(void* stmt,int i)')
    this.textFn = this.lib.func('void* sqlite3_column_text(void* stmt,int i)')
    this.blobFn = this.lib.func('void* sqlite3_column_blob(void* stmt,int i)')
    this.bytesFn = this.lib.func('int sqlite3_column_bytes(void* stmt,int i)')
    this.errorFn = this.lib.func('const char* sqlite3_errmsg(void* db)')
    this.connections = new Map()
  }

  open(path) {
    if (this.connections.has(path)) return this.connections.get(path)
    const out = [null]
    const code = this.openFn(path, out, 1, null)
    if (code !== 0 || !out[0]) throw new Error(`WCDB 打开失败（错误码 ${code}）`)
    if (this.keyFn(out[0], this.key, this.key.length) !== 0) { this.closeFn(out[0]); throw new Error('WCDB 密钥设置失败') }
    this.connections.set(path, out[0])
    return out[0]
  }

  *iterate(path, sql) {
    const db = this.open(path)
    const out = [null]
    const code = this.prepareFn(db, sql, -1, out, null)
    if (code !== 0) throw new Error(`WCDB 查询失败：${this.errorFn(db)}`)
    if (!out[0]) return
    try {
      let state
      while ((state = this.stepFn(out[0])) === 100) {
        const row = {}
        for (let i = 0; i < this.countFn(out[0]); i++) {
          const name = this.nameFn(out[0], i)
          const type = this.typeFn(out[0], i)
          if (type === 1) row[name] = this.intFn(out[0], i)
          else if (type === 2) row[name] = this.doubleFn(out[0], i)
          else if (type === 3) row[name] = koffi.decode(this.textFn(out[0], i), 'char', this.bytesFn(out[0], i))
          else if (type === 4) row[name] = Buffer.from(koffi.decode(this.blobFn(out[0], i), 'uint8', this.bytesFn(out[0], i)))
          else row[name] = null
        }
        yield row
      }
      if (state !== 101) throw new Error(`WCDB 查询中断：${this.errorFn(db)}`)
    } finally { this.finalizeFn(out[0]) }
  }

  query(path, sql) { return [...this.iterate(path, sql)] }

  close() { for (const db of this.connections.values()) this.closeFn(db); this.connections.clear(); this.key.fill(0) }
}
