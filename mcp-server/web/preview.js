(() => {
  let query = ''
  let sessions = []
  let selected = null
  let nextOffset = null
  let next = null
  let sessionsVersion = 0
  let historyVersion = 0
  let sessionsBusy = false
  let historyBusy = false

  const node = (tag, className, text) => {
    const element = document.createElement(tag)
    if (className) element.className = className
    if (text !== undefined) element.textContent = text
    return element
  }
  const error = (id, message = '') => {
    $(id).textContent = message
    $(id).hidden = !message
  }
  const time = (seconds) => new Date(seconds * 1000).toLocaleString('zh-CN')

  function controls() {
    $('preview-more-sessions').hidden = nextOffset === null
    $('preview-more-sessions').disabled = sessionsBusy
    $('preview-earlier').hidden = next === null
    $('preview-earlier').disabled = historyBusy
    $('preview-refresh').disabled = sessionsBusy || historyBusy
  }

  function renderSessions() {
    const list = $('preview-session-list')
    const top = list.scrollTop
    list.replaceChildren()
    for (const session of sessions) {
      const button = node('button', `preview-session${selected?.id === session.id ? ' selected' : ''}`)
      button.type = 'button'
      button.setAttribute('aria-pressed', String(selected?.id === session.id))
      button.append(node('strong', '', session.name), node('span', 'preview-id', session.id), node('time', '', time(session.updatedAt)))
      button.addEventListener('click', () => { void selectSession(session) })
      list.append(button)
    }
    list.scrollTop = top
  }

  async function loadSessions(append = false) {
    const version = ++sessionsVersion
    const params = new URLSearchParams({ query, limit: '50', offset: String(append ? nextOffset : 0) })
    sessionsBusy = true
    error('preview-sessions-error')
    $('preview-sessions-state').textContent = '正在读取会话…'
    if (!append) { sessions = []; nextOffset = null; renderSessions() }
    controls()
    try {
      const page = await request(`preview/sessions?${params}`)
      if (version !== sessionsVersion) return
      sessions = append ? [...sessions, ...page.sessions] : page.sessions
      nextOffset = page.nextOffset
      renderSessions()
      $('preview-sessions-state').textContent = sessions.length ? '' : query ? '没有匹配的会话。' : '暂无缓存会话，请先启动服务完成同步。'
    } catch (reason) {
      if (version !== sessionsVersion) return
      error('preview-sessions-error', reason.message)
      $('preview-sessions-state').textContent = ''
    } finally {
      if (version === sessionsVersion) { sessionsBusy = false; controls() }
    }
  }

  function messageNode(message, session) {
    const row = node('div', `preview-message${message.isSelf ? ' self' : ''}`)
    const meta = node('div', 'preview-message-meta')
    meta.append(node('span', '', message.isSelf ? '我' : message.senderId || session.name), node('time', '', time(message.createdAt)))
    row.append(meta, node('p', 'preview-message-content', message.content))
    return row
  }

  async function loadHistory(earlier = false) {
    if (!selected) return
    const session = selected
    const version = ++historyVersion
    const params = new URLSearchParams({ session_id: session.id, limit: '50' })
    if (earlier) params.set('before', next)
    historyBusy = true
    error('preview-history-error')
    $('preview-history-state').textContent = earlier ? '正在读取更早消息…' : '正在读取最近消息…'
    if (!earlier) { next = null; $('preview-message-list').replaceChildren() }
    controls()
    try {
      const page = await request(`preview/history?${params}`)
      if (version !== historyVersion) return
      selected = page.session
      $('preview-session-name').textContent = page.session.name
      $('preview-session-id').textContent = page.session.id
      next = page.next
      const scroll = $('preview-history-scroll')
      const height = scroll.scrollHeight
      const top = scroll.scrollTop
      const rows = page.messages.map((message) => messageNode(message, page.session))
      if (earlier) $('preview-message-list').prepend(...rows)
      else $('preview-message-list').replaceChildren(...rows)
      $('preview-history-state').textContent = $('preview-message-list').childElementCount ? '' : '该会话暂无缓存消息。'
      scroll.scrollTop = earlier ? top + scroll.scrollHeight - height : scroll.scrollHeight
      renderSessions()
    } catch (reason) {
      if (version !== historyVersion) return
      error('preview-history-error', reason.message)
      $('preview-history-state').textContent = ''
    } finally {
      if (version === historyVersion) { historyBusy = false; controls() }
    }
  }

  async function selectSession(session) {
    selected = session
    $('preview-session-name').textContent = session.name
    $('preview-session-id').textContent = session.id
    renderSessions()
    await loadHistory()
  }

  $('preview-search').addEventListener('submit', (event) => {
    event.preventDefault()
    query = $('preview-query').value.trim()
    selected = null
    ++historyVersion
    historyBusy = false
    next = null
    $('preview-session-name').textContent = '请选择会话'
    $('preview-session-id').textContent = ''
    $('preview-history-state').textContent = '选择左侧会话，查看最近消息。'
    $('preview-message-list').replaceChildren()
    error('preview-history-error')
    void loadSessions()
  })
  $('preview-more-sessions').addEventListener('click', () => {
    if (!sessionsBusy && nextOffset !== null) void loadSessions(true)
  })
  $('preview-earlier').addEventListener('click', () => {
    if (!historyBusy && next !== null) void loadHistory(true)
  })
  $('preview-refresh').addEventListener('click', () => {
    void loadSessions()
    void loadHistory()
  })
  void loadSessions()
})()
