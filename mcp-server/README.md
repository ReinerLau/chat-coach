# 微信历史 MCP

`@reinerlau/wechat-mcp` 读取本机微信数据库，将消息同步到按账号隔离的 SQLite 历史缓存。它通过 stdio MCP 提供会话查找和历史分页。服务自行同步，不需要启动 DSH。它不调用模型，也不发送微信消息。

## 准备环境与数据库密钥

运行前准备：

- macOS arm64、已登录的微信 4.1.13 和 Node.js 22.13+。其他微信版本尚未实机验证。
- 可用的 `clang`，用于首次编译钥匙串辅助程序。
- 与当前微信账号匹配的 64 位十六进制数据库密钥。服务目前不会自动从微信进程提取密钥。

WCDB 库来自 WeFlow，并保留其 CC BY-NC-SA 4.0 许可证。详见 [vendor/weflow/LICENSE](vendor/weflow/LICENSE)。运行时不连接 WeFlow 或 TraceMemo 应用。

服务继续使用原 `chat-coach.wechat-db.v2` macOS 钥匙串项。已有密钥无需迁移。钥匙串辅助程序位于 `~/.wechat-history-mcp/native/keychain`。

如果尚未保存密钥，先按下文安装依赖。然后在源码目录运行以下命令，并输入密钥。输入不会回显：

```sh
node mcp-server/bin/save-db-key.js "/Users/you/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<账号目录>"
```

也可在启动进程的环境中设置 `WECHAT_DB_KEY`。不要把数据库密钥写入启动参数、隧道命令或文档。

如果曾用 TraceMemo 验证该账号，可在安装依赖后一次性导入已有密钥：

```sh
node mcp-server/bin/import-tracememo-key.js "/Users/you/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<账号目录>"
```

## 安装

从源码安装并查看命令：

```sh
npm ci --prefix mcp-server
node mcp-server/bin/wechat-mcp.js --help
```

发布后，新包只托管在 GitHub Packages。按 [GitHub Packages npm 认证说明](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry) 配置本机 npm：使用 `@reinerlau:registry=https://npm.pkg.github.com`，并提供具有 `read:packages` 权限的认证。然后安装：

```sh
npm install -g @reinerlau/wechat-mcp
wechat-mcp --help
wechat-mcp stdio --help
```

当前包版本以 `mcp-server/package.json` 为准。PR 合并后，Auto Tag 工作流依据 PR label 更新 `package.json` 和 lockfile，并创建对应 Git tag。维护者仍需手动运行 **Publish WeChat MCP** 工作流。发布前可用 `npm run test:package --prefix mcp-server` 验证安装包。已有版本不可重复发布。

## 启动和停止

用 `wechat-mcp` 启动管理服务，用 `wechat-mcp stdio` 启动 stdio MCP。完成下文的隧道配置后，日常启动管理服务只需运行：

```sh
wechat-mcp
```

命令会确保服务运行，自动打开中文管理页，并在终端前台等待。按 `Ctrl+C` 会关闭微信历史 MCP、隧道和管理后台。命令会在确认后台退出后结束。启动过程中按 `Ctrl+C`，命令仍会等待启动操作结束，再清理服务。关闭期间连续按 `Ctrl+C` 不会跳过清理。关闭浏览器不会停止服务。

再次运行命令会复用同一后台。任一前台终端按 `Ctrl+C` 都会关闭共享服务；其他前台终端会随后台退出而结束。管理页提供启动、停止和重启操作。页面中的“停止”只关闭微信历史 MCP 与隧道，管理后台和前台终端继续运行。

也可从另一个终端关闭全部服务和管理后台：

```sh
wechat-mcp stop
```

如需命令立即返回并让服务在后台运行，使用 `wechat-mcp --background`。之后用 `wechat-mcp stop` 关闭。`wechat-mcp --no-open` 仅阻止打开浏览器，命令仍在前台等待。脚本中使用 `wechat-mcp --background --no-open`。

从源码启动时，使用 `node mcp-server/bin/wechat-mcp.js`。服务调用 macOS 的 `open` 打开默认浏览器。

### stdio 启动与数据存储

MCP 客户端或隧道应启动并保持以下进程：

```sh
wechat-mcp stdio --account-root "/Users/you/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<账号目录>"
```

从源码启动时，可将命令替换为 `node /absolute/path/to/chat-coach/mcp-server/bin/wechat-mcp.js stdio`。直接在终端运行时，进程会等待 stdin 中的 MCP 请求，不会打开管理页。

历史缓存默认位于 `~/.wechat-history-mcp/accounts/<账号路径哈希>/messages.sqlite`。首次运行会导入全部可读消息；之后监听 `db_storage` 变化，并去重同步。可用 `--data-file /absolute/path/messages.sqlite` 指定缓存。每个账号应使用不同文件。服务不会自动迁移或删除旧 DSH 缓存和配置，而会自行重新同步。

初始化和工具发现不需要等待全量导入。查询会等待当前同步完成；首次查询耗时取决于历史量。同步失败会返回明确错误，不把失败当成空历史。退出或 stdin 关闭时，服务停止监听并关闭数据库。

可用 `--status-file /absolute/path/sync-status.json` 原子写入本机同步状态、进程信息和统计。失败信息经过处理。管理后台自动加入此参数，不新增 MCP 工具。日志仅写 stderr，不含密钥或聊天正文。除 `--help` 外，stdout 仅用于 MCP 协议。

日常管理命令由 `wechat-history` 改为 `wechat-mcp`；不再安装旧命令。服务仍使用原 `~/.wechat-history-mcp/` 数据目录。管理页兼容旧 profile 中不带 `stdio` 的 `wechat-mcp` 和 `wechat-history-mcp` 命令。重启时，管理页会自动使用当前安装包的 `wechat-mcp stdio`。直接启动 stdio 的客户端需添加 `stdio` 子命令。已有隧道无需重建。

## 本机管理页与历史查询

管理页绑定 `127.0.0.1` 的自动分配端口。浏览器标签页和页头共用绿色 W 图标。页面资源随 npm 包提供，无需联网加载。访问地址和页面会话令牌保存在 `~/.wechat-history-mcp/manager.json`，仅当前用户可读。请通过命令打开页面，不共享包含令牌的链接。

接口校验 Host、Origin 和会话令牌，并拒绝跨站请求。它仅提供固定的启停操作和只读历史缓存查询。

管理后台复用 `${XDG_CONFIG_HOME:-~/.config}/tunnel-client/wechat.yaml`；若已有 `wechat-history.yaml`，则优先复用旧文件。配置须包含单个 `main` stdio 通道。启动命令可使用下文示例中的 `node .../wechat-mcp.js stdio` 格式。运行密钥使用 `env:变量名` 或 `file:/绝对路径` 引用。文件引用适合后台运行。

如使用环境变量，须在首次启动管理后台的终端中设置。管理后台的环境会沿用到服务重启。更换环境变量后，先运行 `wechat-mcp stop`，再启动服务。

服务从 PATH 查找隧道客户端，也可通过 `TUNNEL_CLIENT_BIN=/绝对路径/tunnel-client` 指定。后台调用官方 `tunnel-client runtimes connect/status/stop`，确认进程、健康、就绪和 MCP 子进程状态。

首次升级已运行的旧服务后，在管理页点一次“重启”，以启用同步状态报告。现有隧道 ID、钥匙串和历史缓存会保留。

服务状态每 2 秒刷新。页面显示同步成功时间、缓存会话和消息数，以及最近 100 条经过筛选的诊断记录。状态和诊断记录不包含聊天正文或密钥。官方隧道诊断页入口仅指向本机地址。

服务停止后，统计会标记为历史数据。新服务的实时状态不会采用旧进程报告。缺少配置、客户端或运行密钥时，页面会给出准备步骤；启动失败时不会显示成功。缺少微信数据库密钥时，按上文准备密钥，再重启。

“聊天数据预览”可按会话名称或会话 ID 搜索。选择会话后，可查看最近 50 条消息并加载更早历史。会话列表每页 50 条，可继续加载。消息按时间正序显示，标注发送者和时间，并区分自己与对方。非文本消息只显示类型占位。窄屏下，会话和消息上下排列。

预览须手动刷新。点击“刷新预览”，页面会重新读取当前搜索下的会话列表和选中会话的最近消息，并重置分页。

预览只读取已同步的历史缓存，不触发微信同步。停止微信历史 MCP 与隧道后，页面仍可浏览缓存。尚未生成历史缓存时，页面会提示先启动同步。同步正在进行或失败时，预览可能只包含此前已保存的消息。

管理后台按已有配置中的默认历史缓存路径或 `--data-file` 打开只读连接。它不创建或迁移数据库，也不提供编辑、消息全文搜索或附件下载。

本机管理接口 `GET /api/preview/sessions` 和 `GET /api/preview/history` 分别沿用下表两个 MCP 工具的参数与返回结构。默认每次返回 50 条，最多 200 条。每次读取后，管理后台会关闭连接。浏览器不能指定数据库路径。聊天正文按文本显示，不写入状态文件或诊断日志。

更新管理页代码后，先运行 `wechat-mcp stop` 退出旧管理后台，再重新启动。页面中的“重启”只重启微信历史 MCP 与隧道，不能替换已运行的管理后台代码。从源码验证改动时，停止旧后台后运行 `node mcp-server/bin/wechat-mcp.js`。

第一版仅管理已有单账号配置，不提供配置编辑或开机自启。测试时可用 `WECHAT_HISTORY_HOME` 隔离管理元数据目录。该变量不会改变微信历史缓存或钥匙串位置。

### MCP 工具

微信历史 MCP 提供两个只读工具：

| 工具 | 参数 | 返回值与分页 |
| --- | --- | --- |
| `list_wechat_sessions` | `query` 按会话名称或会话 ID 的部分文字查找；`limit` 默认 50、最多 200；`offset` 默认 0。 | 返回 `sessions` 和 `nextOffset`；每个会话的 `id` 是会话 ID。沿 `nextOffset` 加载更多候选会话，更换查询时从 0 开始；为 null 表示没有更多会话。 |
| `get_wechat_history` | 将 `sessions[].id` 传入 `session_id`；`limit` 默认 50、最多 200；可选 `before` 只接受同一会话上一页返回的 `next`。 | 返回 `session`、`messages` 和 `next`。省略 `before` 时读取最近消息，消息按时间正序排列；将 `next` 传入 `before` 读取更早消息，为 null 表示没有更早消息。 |

联系人名称和群名用于查找会话，不能作为会话 ID 传入 `session_id`。同名候选会话须先由用户确认。`isSelf` 标识当前用户发送的消息；`senderId` 区分其他发送者。

微信引用回复会在 `content` 中展示回复正文与引用内容。工具还提供 `replyContent`、`quotedSender`、`quotedContent` 和 `quotedType` 字段。图片、语音、视频等引用只标注类型，不包含附件正文。其他非文本消息只返回类型占位。

## ChatGPT 私有接入

使用 [OpenAI Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) 接入 stdio 服务。连接由本机通过出站 HTTPS 发起，无需开放公网端口。

1. 确认账号可以在 ChatGPT 开启开发者模式，也可以访问 [Platform 隧道设置](https://platform.openai.com/settings/organization/tunnels)。创建隧道需要 Tunnels Read + Manage。运行和使用隧道需要 Read + Use。分别检查隧道权限和 ChatGPT 开发者模式权限。
2. 创建隧道，并关联到本人使用的 ChatGPT 工作区。记录 `tunnel_id`。从设置页或官方 `openai/tunnel-client` 最新 release 安装 `tunnel-client`。
3. 给 `tunnel-client` 配置用于隧道认证的运行时 API key，即 `CONTROL_PLANE_API_KEY` 环境变量。微信历史 MCP 本身不需要模型 API key。不要把实际 key 写入命令示例或提交到仓库。
4. 创建并启动本机 stdio profile。替换下方命令中的账号目录和隧道 ID。此示例从源码启动：

   ```sh
   tunnel-client init \
     --sample sample_mcp_stdio_local \
     --profile wechat \
     --tunnel-id "tunnel_<你的隧道ID>" \
     --mcp-command 'node "/absolute/path/to/chat-coach/mcp-server/bin/wechat-mcp.js" stdio --account-root "/Users/you/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<账号目录>"'

   tunnel-client doctor --profile wechat --explain
   wechat-mcp
   ```

5. 在 ChatGPT 开启开发者模式，创建名为 **wechat** 的私有应用。Connection 选择 **Tunnel**，再选择对应隧道。stdio 服务依靠隧道访问权限，无需额外 OAuth。只关联需要使用的本人工作区，不发布到公共目录。已有「微信历史」应用的显示名可在 ChatGPT 应用设置中修改为 **wechat**。MCP 服务名不会自动修改应用显示名。
6. 在新对话中启用该应用，然后请求：

> 用 wechat 工具查找“小王”，如有多个同名联系人先让我确认。读取最近 50 条消息，再给一条克制自然的回复和一句简短思路。

调用时，电脑须在线，微信数据库须可读，微信历史 MCP 与隧道须保持运行。服务和历史缓存留在本机。工具返回的消息会进入 ChatGPT 当前对话。

如果看不到隧道，检查工作区关联及 Tunnels Read + Use 权限。如果调用失败，检查 `tunnel-client doctor` 和本机 stderr。账号权限须实际检查；本地自动测试不覆盖真实微信、隧道权限或 ChatGPT 端接入。权限不足时，可先用本地 stdio MCP 客户端验证，不自动改为公网服务。

## 验证

```sh
npm test --prefix mcp-server
npm run test:package --prefix mcp-server
```

自动测试使用模拟数据。它覆盖 stdio 初始化、工具发现与调用、消息分页、同步失败和退出清理。管理页测试覆盖安全校验、只读历史缓存查询、WAL 并发读取、预览搜索分页、过期响应、消息文本转义、滚动位置、手动刷新及错误恢复。运行测试还覆盖重复启动、串行启停、超时、前台信号中断（含启动途中和重复中断）及外部停止。独立包测试覆盖管理和 stdio 子命令、页面资源及预览接口。CI 不读取真实微信或 macOS 钥匙串。

用户实机自测：

1. 运行 `wechat-mcp`，确认命令保持前台。按 `Ctrl+C` 后，确认全部进程退出且管理页端口关闭。再次运行，确认服务可恢复。
2. 运行 `wechat-mcp --background`，确认命令立即返回。再从另一个终端运行 `wechat-mcp stop`，确认服务关闭。前台命令运行时，也检查外部停止能使其结束。
3. 检查状态自动刷新。停止微信历史 MCP 与隧道后，确认管理页仍可用。再从页面启动和重启服务。
4. 在“聊天数据预览”搜索指定联系人。查看近期消息，加载更早历史和更多会话。核对发送者、时间和非文本占位。停止服务后，再确认预览仍可读取缓存。
5. 重新启动服务并收到新微信消息后，等待同步完成。手动刷新预览，确认新消息出现。检查窄屏布局。关闭浏览器后，确认服务仍运行；用 `wechat-mcp stop` 关闭全部后台。
6. 不启动 DSH，在 ChatGPT 查找指定联系人，读取近期消息并向前翻页。收到新微信消息后再次读取，确认能看到增量同步的消息。

确认符合预期后，反馈“验证通过”或描述问题。
