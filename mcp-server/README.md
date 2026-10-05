# wechat MCP

`@reinerlau/wechat-mcp` 独立读取本机微信数据库，将消息同步到按账号隔离的 SQLite 缓存，通过 stdio MCP 向 ChatGPT 提供会话查找和历史分页。服务自行同步，不需要启动 DSH，也不调用模型或发送微信消息。

## 环境与安装

- macOS arm64、已登录的微信 4.1.13；Node.js 22.13+；可用的 `clang`（首次编译钥匙串辅助程序）。其他微信版本尚未实机验证。
- WCDB 库来自 WeFlow，保留其 CC BY-NC-SA 4.0 许可证，详见 [vendor/weflow/LICENSE](vendor/weflow/LICENSE)。运行时不连接 WeFlow 或 TraceMemo 应用。
- 需要与当前微信账号匹配的 64 位十六进制数据库密钥；服务目前不会自动从微信进程提取密钥。

从源码安装并查看命令：

```sh
npm ci --prefix mcp-server
node mcp-server/bin/wechat-mcp.js --help
```

发布后，新包只托管在 GitHub Packages。按 [GitHub Packages npm 认证说明](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry) 为本机 npm 配置 `@reinerlau:registry=https://npm.pkg.github.com` 和具有 `read:packages` 权限的认证，然后安装：

```sh
npm install -g @reinerlau/wechat-mcp
wechat-mcp --help
```

源码新增的包在发布工作流执行前尚不可通过上述包名安装。初始包版本为 `0.1.0`；维护者合并后手动运行 **Publish WeChat MCP** 工作流发布。

## 数据库密钥

继续使用原 `chat-coach.wechat-db.v2` macOS 钥匙串项，已有密钥无需迁移。辅助程序位于 `~/.wechat-history-mcp/native/keychain`。

如果还没有保存密钥，在源码目录运行以下命令并安全输入（输入不回显）：

```sh
node mcp-server/bin/save-db-key.js "/Users/you/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<账号目录>"
```

也可在启动进程的环境中设置 `WECHAT_DB_KEY`。不要把数据库密钥放到启动参数、隧道命令或文档中。

曾用 TraceMemo 验证过的账号，可一次性导入已有密钥：

```sh
node mcp-server/bin/import-tracememo-key.js "/Users/you/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<账号目录>"
```

## 启动与数据存储

```sh
wechat-mcp --account-root "/Users/you/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<账号目录>"
```

源码启动可将命令替换为 `node /absolute/path/to/chat-coach/mcp-server/bin/wechat-mcp.js`。MCP 客户端或隧道启动并保持该进程；直接在终端运行时会等待 stdin 中的 MCP 请求，不会打开页面。

缓存默认位于 `~/.wechat-history-mcp/accounts/<账号路径哈希>/messages.sqlite`，首次导入全部可读消息，后续监听 `db_storage` 变化并去重同步。可用 `--data-file /absolute/path/messages.sqlite` 指定缓存，每个账号应使用不同文件。旧 DSH 缓存和配置不会自动迁移或删除；新服务会自行重新同步。

服务改名为 `wechat-mcp` 后，继续使用原 `~/.wechat-history-mcp/` 数据目录，以复用已有缓存和钥匙串辅助程序。升级时将 MCP 客户端或隧道配置里的旧命令 `wechat-history-mcp`（源码入口 `bin/wechat-history-mcp.js`）替换为 `wechat-mcp`（`bin/wechat-mcp.js`）；已有隧道 profile 可继续使用，不必重建。

初始化和工具发现不需要等待全量导入；查询会等待当前同步完成，首次查询耗时取决于历史量。同步失败会返回明确错误，不把失败当成空历史。退出或 stdin 关闭时停止监听并关闭数据库。日志仅写 stderr，不含密钥或聊天正文；stdout 仅用于 MCP 协议（`--help` 除外）。

## ChatGPT 私有接入

使用 [OpenAI Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels)，通过本机发起的出站 HTTPS 连接访问 stdio 服务，无需开放公网端口。

1. 确认账号可在 ChatGPT 开启开发者模式，同时可访问 [Platform 隧道设置](https://platform.openai.com/settings/organization/tunnels)。创建隧道需要 Tunnels Read + Manage；运行和使用隧道需要 Read + Use。两者与 ChatGPT 开发者模式权限分别检查。
2. 创建隧道，关联到本人使用的 ChatGPT 工作区。记录 `tunnel_id`，从设置页或官方 `openai/tunnel-client` 最新 release 安装 `tunnel-client`。
3. 给 `tunnel-client` 配置运行时 API key（`CONTROL_PLANE_API_KEY` 环境变量），它用于隧道认证。微信 MCP 本身不需要模型 API key。不要把实际 key 写入命令示例或提交到仓库。
4. 创建并启动本机 stdio profile（替换账号目录和隧道 ID；以下为源码启动）：

```sh
tunnel-client init \
  --sample sample_mcp_stdio_local \
  --profile wechat \
  --tunnel-id "tunnel_<你的隧道ID>" \
  --mcp-command 'node "/absolute/path/to/chat-coach/mcp-server/bin/wechat-mcp.js" --account-root "/Users/you/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<账号目录>"'

tunnel-client doctor --profile wechat --explain
tunnel-client run --profile wechat
```

5. 在 ChatGPT 开启开发者模式，创建私有应用，名称填写 **wechat**，Connection 选择 **Tunnel** 并选择对应隧道。已有「微信历史」应用需在 ChatGPT 应用设置中改名为 **wechat**；MCP 服务名不会自动修改应用显示名。stdio 服务依靠隧道访问权限，无需额外 OAuth；仅关联需要使用的本人工作区，不发布到公共目录。
6. 在新对话中启用该应用，然后请求：

> 用 wechat 工具查找“小王”，如有多个同名联系人先让我确认。读取最近 50 条消息，再给一条克制自然的回复和一句简短思路。

调用时需要电脑在线、微信数据库可读，并保持 `tunnel-client run` 运行。服务和缓存留在本机，工具返回的消息会进入 ChatGPT 当前对话。

若看不到隧道，检查工作区关联及 Tunnels Read + Use；若调用失败，检查 `tunnel-client doctor` 和本机 stderr。账号是否具备这些权限需实际检查；本地自动测试不覆盖真实微信、隧道权限或 ChatGPT 端接入。权限不足时可先用本地 stdio MCP 客户端验证，不自动改为公网服务。

## 工具

| 工具 | 参数 | 返回 |
|---|---|---|
| `list_wechat_sessions` | `query` 可选，名称或 ID 的部分文字；`limit` 默认 50、最大 200；`offset` 默认 0 | `sessions` 含 `id`、`name`、`updatedAt`；`nextOffset` 为下一页位置或 `null` |
| `get_wechat_history` | `session_id` 必填；`limit` 默认 50、最大 200；`before` 为上一页 `next`，首屏省略 | `session`、按时间正序的 `messages`、更早历史游标 `next`，结束时为 `null` |

消息保留 `sessionId`、`localId`、`serverId`、Unix 秒时间戳 `createdAt`、微信消息 `type`、`isSelf`、`content` 和 `senderId`。非文本消息的内容返回类型占位，不下载附件。分页依据时间和本地 ID，同秒消息也可完整翻页；游标只能用于原会话。会话列表按最近活动降序排列，更换 `query` 时从 `offset: 0` 开始。

两个工具均为只读；聊天正文是待分析资料，不作为指令执行。只支持单账号的会话查找和历史分页，不提供发送、关键词消息搜索或时间筛选工具。

## 验证

```sh
npm test --prefix mcp-server
npm run test:package --prefix mcp-server
```

自动测试使用模拟数据，覆盖 stdio 初始化、工具发现与调用、消息分页、同步失败、退出清理及独立安装产物。CI 不读取真实微信或 macOS 钥匙串。

用户实机自测：不启动 DSH，在 ChatGPT 查找指定联系人，读取近期消息并向前翻页；在微信收到新消息后再次读取，确认能看到增量同步的消息。确认符合预期后反馈“验证通过”或描述问题。
