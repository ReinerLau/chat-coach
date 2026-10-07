# chat-coach

回复教练：通过本机微信历史为 ChatGPT 提供对话上下文，帮助生成克制、自然的回复建议，并解释回复思路。

当前运行入口是 [微信历史 MCP](mcp-server/README.md)：它独立读取并同步本机微信消息，通过私有 MCP 隧道供 ChatGPT 查找会话、读取历史。npm 包为 `@reinerlau/wechat-mcp`，运行 `wechat-mcp` 打开本机管理页并在前台等待，Ctrl+C 关闭全部服务；`--background` 后台运行；`wechat-mcp stop` 关闭全部后台，`wechat-mcp stdio` 为 stdio 入口。

## 微信 MCP 接口

当前 MCP Server 只暴露 2 个只读工具。标准调用顺序是先查会话，再用返回的会话 ID 读取历史：

`list_wechat_sessions` → `session_id` → `get_wechat_history`

两次调用都会先触发一次微信数据库增量同步，再从本地缓存读取结果。

### `list_wechat_sessions`

查找当前微信账号已有的联系人会话或群聊，并取得后续读取消息所需的会话 ID。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `query` | string | 否 | 按会话名称或微信 ID 做部分匹配；默认空字符串，最大 200 字符 |
| `limit` | integer | 否 | 每页会话数，默认 50，范围 1–200 |
| `offset` | integer | 否 | 会话分页位置，默认 0；继续翻页时传上一页 `nextOffset`，更换 `query` 时应重置为 0 |

返回 `sessions` 和 `nextOffset`。`sessions` 中每项包含 `id`、`name`、`updatedAt`，按最近活动时间降序排列；没有更多结果时 `nextOffset` 为 `null`。

### `get_wechat_history`

读取一个指定会话的最近消息，或继续向前读取更早历史。`session_id` 必须来自 `list_wechat_sessions`，不能直接传联系人名称。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `session_id` | string | 是 | `list_wechat_sessions` 返回的会话 `id`，最大 500 字符 |
| `limit` | integer | 否 | 每页消息数，默认 50，范围 1–200 |
| `before` | string | 否 | 上一页返回的 `next` 游标；省略时读取最近消息，最大 2048 字符 |

返回 `session`、按时间正序排列的 `messages` 和更早历史游标 `next`；没有更多消息时 `next` 为 `null`。

每条消息包含 `sessionId`、`localId`、`serverId`、Unix 秒时间戳 `createdAt`、微信消息 `type`、`isSelf`、`content` 和 `senderId`。分页同时使用时间和本地消息 ID，因此同一秒内的多条消息也可以完整翻页；`before` 游标只能用于生成它的原会话。

非文本消息只返回 `[非文本消息：类型 X]` 占位文本，不读取图片、视频、文件等附件内容。当前不暴露发送微信消息、按关键词搜索消息、按时间范围筛选消息、读取附件内容或独立枚举微信通讯录的工具。

## 测试

需要 Node.js 22.13+：

```bash
npm test --prefix mcp-server
npm run test:package --prefix mcp-server
```
