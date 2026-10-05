const $ = (id) => document.getElementById(id)
const token = location.hash.slice(1) || sessionStorage.getItem('wechat-manager-token')
if (location.hash) {
  sessionStorage.setItem('wechat-manager-token', token)
  history.replaceState(null, '', location.pathname)
}
const names = { running: '运行正常', connected: '已连接', stopped: '已停止', starting: '正在启动', stopping: '正在停止', restarting: '正在重启', error: '需要处理', idle: '同步完成', syncing: '正在同步', unavailable: '暂不可用', unknown: '无法确认' }
let pending = false
let refreshing = false
let lastState

async function request(path, post = false) {
  let response
  try {
    response = await fetch(`/api/${path}`, {
      ...(post ? { method: 'POST', body: '{}' } : {}),
      headers: { 'X-Wechat-Manager-Token': token || '', ...(post ? { 'Content-Type': 'application/json' } : {}) }
    })
  } catch { throw new Error('无法连接管理后台，请重新运行 wechat-mcp 打开页面。') }
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || '操作未完成。')
  return result
}

function showError(message) {
  $('error').hidden = !message
  $('error').textContent = message || ''
}

function buttons(state) {
  const busy = pending || Boolean(state?.operation)
  $('start').disabled = busy || state?.state === 'running'
  $('stop').disabled = busy || state?.state === 'stopped'
  $('restart').disabled = busy || state?.state === 'stopped'
}

function render(state) {
  lastState = state
  $('status').textContent = names[state.state] || '无法确认'
  $('status').className = `badge ${state.state}`
  $('summary').textContent = state.operation ? '操作进行中，请稍候。' : state.state === 'running' ? '已就绪，可以在 ChatGPT 中使用微信历史。' : state.state === 'stopped' ? '启动服务后，ChatGPT 即可访问历史。' : '请查看下方提示，处理后重试。'
  $('mcp').textContent = names[state.mcp] || '无法确认'
  $('tunnel').textContent = names[state.tunnel] || '无法确认'
  $('sync').textContent = names[state.sync.phase] || '暂无记录'
  $('sessions').textContent = state.sync.sessions?.toLocaleString('zh-CN') ?? '—'
  $('messages').textContent = state.sync.messages?.toLocaleString('zh-CN') ?? '—'
  $('last-sync').textContent = state.sync.lastSuccessAt ? `上次成功 ${new Date(state.sync.lastSuccessAt).toLocaleString('zh-CN')}` : '尚无同步成功记录'
  $('sync-note').textContent = state.sync.stale ? '历史统计；实时状态将在启动或重启后更新' : '监听本机微信数据库变化'
  $('diagnostics').hidden = !state.diagnosticsUrl
  $('diagnostics-empty').hidden = Boolean(state.diagnosticsUrl)
  if (state.diagnosticsUrl) $('diagnostics').href = state.diagnosticsUrl
  showError(state.error)
  buttons(state)
  $('logs').replaceChildren()
  if (!state.logs.length) {
    const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = '暂无诊断记录'; $('logs').append(empty)
  }
  for (const log of state.logs.toReversed()) {
    const row = document.createElement('div'); row.className = 'log'
    const time = document.createElement('time'); time.textContent = log.time ? new Date(log.time).toLocaleTimeString('zh-CN') : '—'
    const level = document.createElement('span'); level.className = `level ${log.level}`; level.textContent = log.level
    const message = document.createElement('span'); message.textContent = log.message
    row.append(time, level, message); $('logs').append(row)
  }
  $('refreshed').textContent = `更新于 ${new Date().toLocaleTimeString('zh-CN')}`
}

async function refresh() {
  if (refreshing || pending) return
  refreshing = true
  try { render(await request('status')) }
  catch (error) {
    $('status').textContent = '管理后台不可用'; $('status').className = 'badge error'; showError(error.message)
    $('summary').textContent = '重新运行 wechat-mcp 可恢复服务并打开管理页。'
    document.querySelectorAll('[data-action]').forEach((button) => { button.disabled = true })
  } finally { refreshing = false }
}

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', async () => {
    pending = true; buttons(lastState); showError(null)
    $('summary').textContent = '操作进行中，请稍候。'
    $('status').textContent = names[{ start: 'starting', stop: 'stopping', restart: 'restarting' }[button.dataset.action]]
    try { render(await request(button.dataset.action, true)) }
    catch (error) { showError(error.message) }
    finally { pending = false; buttons(lastState); await refresh() }
  })
})
void refresh()
setInterval(refresh, 2000)
