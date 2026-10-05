function first(row, names) {
  for (const name of names) {
    if (row[name] !== undefined && row[name] !== null) return row[name]
  }
  return undefined
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
