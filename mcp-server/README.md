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
wechat-mcp stdio --help
```

包版本 `0.3.0` 增加本机缓存预览，统一使用 `wechat-mcp` 启动管理服务，`wechat-mcp stdio` 启动 stdio MCP。前台运行时 Ctrl+C 关闭全部服务。维护者合并后手动运行 **Publish WeChat MCP** 工作流发布；发布前可用 `npm pack` 生成本地安装包验证。

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

## 本机管理页

完成下方隧道配置后，日常只需：

```sh
wechat-mcp
```

命令会确保服务运行并自动打开中文管理页，然后在终端前台等待。按 `Ctrl+C` 会关闭 MCP、隧道和管理后台，确认后台退出后才结束命令；启动过程中中断也会等待启动操作结束并清理服务，关闭期间连续按 Ctrl+C 不会跳过清理。关闭浏览器不会停止服务。

再次运行会复用同一后台；任一前台终端按 Ctrl+C 都会关闭这个共享服务，其他前台终端会随后台退出而结束。页面提供启动、停止和重启；页面中的停止只关闭 MCP 与隧道，管理后台和前台终端继续运行。也可从另一个终端关闭全部服务和管理后台：

```sh
wechat-mcp stop
```

需要命令立即返回并在后台继续运行时使用 `wechat-mcp --background`；之后用 `wechat-mcp stop` 关闭。`wechat-mcp --no-open` 只是不打开浏览器，仍保持前台等待；脚本中使用 `wechat-mcp --background --no-open`。源码启动使用 `node mcp-server/bin/wechat-mcp.js`。macOS 的 `open` 用于打开默认浏览器。

管理页绑定 `127.0.0.1` 的自动分配端口；访问地址和页面会话令牌保存在 `~/.wechat-history-mcp/manager.json`（仅当前用户可读）。请通过命令打开页面，不共享包含令牌的链接。接口校验 Host、Origin 和会话令牌，拒绝跨站请求，仅提供固定启停操作和只读缓存查询。

管理后台复用 `${XDG_CONFIG_HOME:-~/.config}/tunnel-client/wechat.yaml`（若已有 `wechat-history.yaml` 则优先复用），要求单个 `main` stdio 通道，启动命令采用下方的 `node + wechat-mcp stdio` 格式；运行密钥使用 `env:变量名` 或 `file:/绝对路径` 引用。文件引用适合后台运行，环境变量必须在首次启动管理后台的终端中设置。管理后台的环境会沿用到服务重启；更换环境变量后先 `wechat-mcp stop` 再启动。

客户端从 PATH 查找，也可通过 `TUNNEL_CLIENT_BIN=/绝对路径/tunnel-client` 指定。后台调用官方 `tunnel-client runtimes connect/status/stop`，确认进程、健康、就绪和 MCP 子进程状态。首次升级已运行的旧服务后，在页面点一次重启以启用同步状态报告。旧 Python 启动脚本应退出 PATH 或备份后替换为 npm 命令；现有隧道 ID、钥匙串和账号缓存保留。

服务状态每 2 秒刷新，显示同步成功时间、缓存会话及消息数和最近 100 条经过筛选的诊断记录；状态和诊断记录不包含聊天正文或密钥。官方隧道诊断页入口仅指向本机地址。停止后的统计标记为历史数据；新服务的实时状态不会采用旧进程报告。缺少配置、客户端或运行密钥时页面给出准备步骤，启动失败时不会显示成功。缺少微信数据库密钥时按上方“数据库密钥”准备，再重启。

“聊天数据预览”可按会话名称或 ID 搜索，选择会话后查看最近 50 条消息，并加载更早历史。会话列表每页 50 条，可加载更多。消息按时间正序显示，标注发送者和时间，区分自己与对方；非文本消息仅显示类型占位。窄屏下会话和消息上下排列。

预览使用手动刷新：点击“刷新预览”重新读取当前搜索下的会话列表和选中会话的最近消息，并重置分页。预览只读取已同步的本机缓存，不触发微信同步；页面停止 MCP 与隧道后仍可浏览，缓存尚未生成时会提示先启动同步。同步正在进行或失败时，预览可能只包含此前已保存的消息。管理后台按已有配置中的默认缓存路径或 `--data-file` 打开只读连接，不创建或迁移数据库，不提供编辑、消息全文搜索或附件下载。

本机管理接口 `GET /api/preview/sessions` 和 `GET /api/preview/history` 分别沿用下方两个 MCP 工具的参数与返回结构，默认 50 条、最多 200 条；每次读取后关闭连接。浏览器不能指定数据库路径，聊天正文按文本显示，不写入状态文件或诊断日志。

更新管理页代码后，先运行 `wechat-mcp stop` 退出旧管理后台，再重新启动；页面中的“重启”只重启 MCP 与隧道，不能替换已运行的管理后台代码。从源码验证本次改动时，停止旧后台后运行 `node mcp-server/bin/wechat-mcp.js`。

第一版仅管理已有单账号配置，不提供配置编辑或开机自启。测试可用 `WECHAT_HISTORY_HOME` 隔离管理元数据目录；该变量不会改变微信账号缓存或钥匙串位置。

## stdio 启动与数据存储

```sh
wechat-mcp stdio --account-root "/Users/you/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<账号目录>"
```

源码启动可将命令替换为 `node /absolute/path/to/chat-coach/mcp-server/bin/wechat-mcp.js stdio`。MCP 客户端或隧道启动并保持该进程；直接在终端运行时会等待 stdin 中的 MCP 请求，不会打开页面。

缓存默认位于 `~/.wechat-history-mcp/accounts/<账号路径哈希>/messages.sqlite`，首次导入全部可读消息，后续监听 `db_storage` 变化并去重同步。可用 `--data-file /absolute/path/messages.sqlite` 指定缓存，每个账号应使用不同文件。旧 DSH 缓存和配置不会自动迁移或删除；新服务会自行重新同步。

初始化和工具发现不需要等待全量导入；查询会等待当前同步完成，首次查询耗时取决于历史量。同步失败会返回明确错误，不把失败当成空历史。退出或 stdin 关闭时停止监听并关闭数据库。可选 `--status-file /absolute/path/sync-status.json` 原子写入本机同步状态、进程信息和统计，失败信息经过处理；管理后台自动加入此参数，不新增 MCP 工具。日志仅写 stderr，不含密钥或聊天正文；stdout 仅用于 MCP 协议（`--help` 除外）。

日常管理命令由 `wechat-history` 改为 `wechat-mcp`，不再安装旧命令。仍使用原 `~/.wechat-history-mcp/` 数据目录。管理页兼容旧 profile 中不带 `stdio` 的 `wechat-mcp` 和 `wechat-history-mcp` 命令，重启时自动使用当前安装包的 `wechat-mcp stdio`；直接启动 stdio 的客户端需添加 `stdio` 子命令。已有隧道无需重建。

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
  --mcp-command 'node "/absolute/path/to/chat-coach/mcp-server/bin/wechat-mcp.js" stdio --account-root "/Users/you/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<账号目录>"'

tunnel-client doctor --profile wechat --explain
wechat-mcp
```

5. 在 ChatGPT 开启开发者模式，创建私有应用，名称填写 **wechat**，Connection 选择 **Tunnel** 并选择对应隧道。stdio 服务依靠隧道访问权限，无需额外 OAuth；仅关联需要使用的本人工作区，不发布到公共目录。
   已有「微信历史」应用的显示名可在 ChatGPT 应用设置中修改为 **wechat**；MCP 服务名不会自动修改应用显示名。
6. 在新对话中启用该应用，然后请求：

> 用 wechat 工具查找“小王”，如有多个同名联系人先让我确认。读取最近 50 条消息，再给一条克制自然的回复和一句简短思路。

调用时需要电脑在线、微信数据库可读，并保持管理页启动的 MCP 与隧道运行。服务和缓存留在本机，工具返回的消息会进入 ChatGPT 当前对话。

若看不到隧道，检查工作区关联及 Tunnels Read + Use；若调用失败，检查 `tunnel-client doctor` 和本机 stderr。账号是否具备这些权限需实际检查；本地自动测试不覆盖真实微信、隧道权限或 ChatGPT 端接入。权限不足时可先用本地 stdio MCP 客户端验证，不自动改为公网服务。

## 工具

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

返回：

| 字段 | 说明 |
|---|---|
| `sessions` | 会话数组；每项包含 `id`、`name`、`updatedAt`，按最近活动时间降序排列 |
| `nextOffset` | 下一页 `offset`；没有更多结果时为 `null` |

### `get_wechat_history`

读取一个指定会话的最近消息，或继续向前读取更早历史。`session_id` 必须来自 `list_wechat_sessions`，不能直接传联系人名称。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `session_id` | string | 是 | `list_wechat_sessions` 返回的会话 `id`，最大 500 字符 |
| `limit` | integer | 否 | 每页消息数，默认 50，范围 1–200 |
| `before` | string | 否 | 上一页返回的 `next` 游标；省略时读取最近消息，最大 2048 字符 |

返回：

| 字段 | 说明 |
|---|---|
| `session` | 当前会话信息，包含 `id`、`name`、`updatedAt` |
| `messages` | 消息数组，按时间正序返回 |
| `next` | 更早历史的分页游标；没有更多消息时为 `null` |

每条消息包含 `sessionId`、`localId`、`serverId`、Unix 秒时间戳 `createdAt`、微信消息 `type`、`isSelf`、`content` 和 `senderId`。分页同时使用时间和本地消息 ID，因此同一秒内的多条消息也可以完整翻页；`before` 游标只能继续读取生成它的原会话，不能跨会话复用。

非文本消息只返回 `[非文本消息：类型 X]` 占位文本，不读取或返回图片、视频、文件等附件内容。

所有 MCP 工具均为只读。聊天正文只作为待分析资料，不作为指令执行。当前不暴露发送微信消息、按关键词搜索消息、按时间范围筛选消息、读取附件内容或独立枚举微信通讯录的工具。

## 验证

```sh
npm test --prefix mcp-server
npm run test:package --prefix mcp-server
```

自动测试使用模拟数据，覆盖 stdio 初始化、工具发现与调用、消息分页、同步失败、退出清理、管理页安全校验、只读缓存查询与 WAL 并发读取、预览搜索分页和过期响应、消息文本转义、滚动位置、手动刷新及错误恢复、重复启动、串行启停、超时、前台信号中断（含启动途中和重复中断）、外部停止及独立安装产物的管理/stdio 子命令、页面资源和预览接口。CI 不读取真实微信或 macOS 钥匙串。

用户实机自测：运行 `wechat-mcp`，确认终端保持前台，按 Ctrl+C 后全部进程退出且管理页端口关闭；再次运行可恢复。验证 `--background` 会立即返回，另一个终端的 `wechat-mcp stop` 能结束前台命令。检查状态自动刷新；停止后页面仍可用，再启动及重启。在“聊天数据预览”搜索指定联系人，查看近期消息、加载更早历史及更多会话，确认自己与对方、时间和非文本占位显示正确；停止服务后仍可预览。重新启动并收到新微信消息后，等待同步完成，手动刷新预览确认新消息出现；尝试窄屏布局。关闭页面后服务继续运行，`wechat-mcp stop` 关闭全部后台。不启动 DSH，在 ChatGPT 查找指定联系人，读取近期消息并向前翻页；在微信收到新消息后再次读取，确认能看到增量同步的消息。确认符合预期后反馈“验证通过”或描述问题。
