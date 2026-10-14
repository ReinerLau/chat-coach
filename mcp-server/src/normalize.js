function first(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null) return row[name]
  }
  return undefined
}

function decodeXmlEntities(value) {
  return String(value || '')
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
}

function xmlValue(xml, tag) {
  const match = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`, 'i').exec(xml)
  if (!match?.[1]) return ''
  const cdata = /^<!\[CDATA\[([\s\S]*?)\]\]>$/.exec(match[1].trim())
  return (cdata ? cdata[1] : decodeXmlEntities(match[1])).trim()
}

export function parseQuotedReply(value) {
  let xml = String(value || '')
  if (!/<refermsg\b/i.test(xml) && /&lt;\/?refermsg\b/i.test(xml)) {
    xml = decodeXmlEntities(xml)
  }
  const referMatch = /<refermsg\b[^>]*>[\s\S]*?<\/refermsg\s*>/i.exec(xml)
  if (!referMatch) return null

  const referXml = referMatch[0]
  const outerXml = xml.replace(referMatch[0], '')
  const quotedType = xmlValue(referXml, 'type')
  const quotedRawContent = xmlValue(referXml, 'content')
  const quotedSender = xmlValue(referXml, 'displayname') ||
    xmlValue(referXml, 'chatusr') || xmlValue(referXml, 'fromusr')
  let quotedContent = quotedRawContent
  if (quotedType === '3') quotedContent = '[图片]'
  else if (quotedType === '34') quotedContent = '[语音]'
  else if (quotedType === '43') quotedContent = '[视频]'
  else if (quotedType === '47') quotedContent = '[表情]'
  else if (quotedType === '49') quotedContent = xmlValue(referXml, 'title') || '[分享消息]'
  else if (!quotedContent) quotedContent = '[引用消息]'

  const replyContent = xmlValue(outerXml, 'title')
  const quoteLabel = quotedSender ? `引用（${quotedSender}）` : '引用'
  const content = [replyContent, `${quoteLabel}：${quotedContent}`].filter(Boolean).join('\n')
  return { content, replyContent, quotedContent, quotedSender, quotedType }
}

export function normalizeSession(row) {
  const id = String(first(row, ['username', 'sessionId', 'session_id', 'userName']) ?? '')
  if (!id) return null
  return {
    id,
    name: String(first(row, ['remark', 'nickname', 'nick_name', 'wechatNickname', 'displayName']) ?? id)
  }
}

export function normalizeMessage(row, sessionId) {
  const localId = String(first(row, ['mesLocalID', 'local_id', 'localId', 'WCDB_CT_local_id']) ?? '')
  if (!localId) return null
  const content = first(row, ['msgContent', 'message_content', 'content', 'WCDB_CT_message_content'])
  const time = Number(first(row, ['msgCreateTime', 'create_time', 'createTime']) ?? 0)
  const type = Number(first(row, ['messageType', 'local_type', 'type']) ?? 0)
  const direction = Number(first(row, ['mesDes', 'is_self', 'isSelf']) ?? -1)
  return {
    sessionId,
    localId,
    serverId: String(first(row, ['serverId', 'svr_id', 'server_id']) ?? ''),
    createdAt: Number.isFinite(time) ? time : 0,
    type: Number.isFinite(type) ? type : 0,
    isSelf: direction === 0 || direction === 1 && row.isSelf === true,
    content: typeof content === 'string' ? content : '',
    senderId: String(first(row, ['sender', 'sender_username', 'real_sender_id']) ?? '')
  }
}
