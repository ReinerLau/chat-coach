# 微信历史 MCP

`@reinerlau/wechat-mcp` 将本机微信消息同步到按账号隔离的 SQLite 历史缓存。

它通过 stdio MCP 提供只读查询。服务自行同步，无需启动 DSH。
它不调用模型，也不发送微信消息。

## 开始使用

### 运行条件

- macOS arm64、已登录的微信 4.1.13、Node.js 22.13+。
- 首次编译钥匙串辅助程序时，需要可用的 `clang`。
- 准备与当前微信账号匹配的 64 位十六进制数据库密钥。服务不会自动从微信进程提取密钥。

其他微信版本尚未实机验证。

WCDB 库来自 WeFlow，保留 CC BY-NC-SA 4.0 许可证，见 [vendor/weflow/LICENSE](vendor/weflow/LICENSE)。
运行时不连接 WeFlow 或 TraceMemo 应用。

### 安装

从源码安装依赖并查看命令。

```sh
npm ci --prefix mcp-server
node mcp-server/bin/wechat-mcp.js --help
```

包发布后，只从 GitHub Packages 安装。

按 [GitHub Packages npm 认证说明](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry) 配置：

- `@reinerlau:registry=https://npm.pkg.github.com`
- 具有 `read:packages` 权限的认证。

```sh
npm install -g @reinerlau/wechat-mcp
wechat-mcp --help
wechat-mcp stdio --help
```

### 准备数据库密钥

已有 `chat-coach.wechat-db.v2` macOS 钥匙串项时，无需迁移。

未保存密钥时，在源码目录运行下方命令并输入密钥。输入不会回显。

```sh
node mcp-server/bin/save-db-key.js "/Users/you/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<账号目录>"
```

也可在启动进程的环境中设置 `WECHAT_DB_KEY`。

不要把密钥写入启动参数、隧道命令或文档。
已有 TraceMemo 密钥的导入方法见[数据库密钥补充](#数据库密钥补充)。

### 启动与停止

完成下文的隧道配置后，运行 `wechat-mcp`。
命令会打开中文管理页，并在终端前台等待。

```sh
wechat-mcp
```

按 `Ctrl+C` 会关闭微信历史 MCP、隧道和管理后台。
关闭浏览器不会停止服务。

也可从另一个终端运行停止命令。

```sh
wechat-mcp stop
```

管理页只绑定 `127.0.0.1`。请通过命令打开页面。
不要共享包含会话令牌的链接。

- 后台运行：`wechat-mcp --background` 启动，`wechat-mcp stop` 关闭。
- 不打开浏览器：`wechat-mcp --no-open`。命令仍在前台等待。

其他启停行为见[运行参考](#运行参考)。

## 接入 ChatGPT

使用 [OpenAI Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) 访问本机 stdio 服务。
连接由本机通过出站 HTTPS 发起，无需开放公网端口。

1. 在 ChatGPT 开启开发者模式，确认可访问 [Platform 隧道设置](https://platform.openai.com/settings/organization/tunnels)。
   - 创建隧道需要 Tunnels Read + Manage；运行和使用需要 Read + Use。
   - 这些权限与 ChatGPT 开发者模式分别检查。
2. 创建隧道，关联到本人使用的 ChatGPT 工作区，并记录 `tunnel_id`。
   - 从设置页或官方 `openai/tunnel-client` 最新 release 安装 `tunnel-client`。
3. 给 `tunnel-client` 设置用于隧道认证的 `CONTROL_PLANE_API_KEY` 环境变量。
   - 微信历史 MCP 不需要模型 API key。不要将实际 key 写进命令示例或仓库。
4. 创建本机 stdio profile。替换命令中的账号目录和隧道 ID。此示例从源码启动。

   ```sh
   tunnel-client init \
     --sample sample_mcp_stdio_local \
     --profile wechat \
     --tunnel-id "tunnel_<你的隧道ID>" \
     --mcp-command 'node "/absolute/path/to/chat-coach/mcp-server/bin/wechat-mcp.js" stdio --account-root "/Users/you/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<账号目录>"'

   tunnel-client doctor --profile wechat --explain
   wechat-mcp
   ```

5. 在 ChatGPT 创建名为 **wechat** 的私有应用。
   - Connection 选择 **Tunnel** 和对应隧道。stdio 服务依靠隧道权限，无需额外 OAuth。
   - 只关联本人需要使用的工作区，不发布到公共目录。
6. 在新对话中启用应用，然后请求读取微信历史。

> 用 wechat 工具查找“小王”，如有多个同名联系人先让我确认。读取最近 50 条消息，再给一条克制自然的回复和一句简短思路。

调用时，电脑须在线，微信数据库须可读，微信历史 MCP 与隧道须保持运行。

服务和历史缓存留在本机。工具返回的消息会进入 ChatGPT 当前对话。

- 看不到隧道：检查工作区关联及 Tunnels Read + Use 权限。
- 调用失败：检查 `tunnel-client doctor` 和本机 stderr。
- 权限不足：可先用本地 stdio MCP 客户端验证。

应用显示名、旧配置和测试边界见[运行参考](#运行参考)。

## 查看历史

管理页的“聊天数据预览”提供以下操作。

- 搜索：按会话名称或会话 ID 查找。会话列表每页 50 条，可继续加载。
- 阅读：选择会话，查看最近 50 条消息，并加载更早历史。
  消息按时间正序显示，标注发送者和时间，区分自己与对方。非文本消息只显示类型占位。
- 刷新：点击“刷新预览”，重新读取当前搜索下的会话列表和选中会话的最近消息，并重置分页。
  窄屏下，会话和消息上下排列。

预览只读取已同步的历史缓存，不触发微信同步。
停止微信历史 MCP 与隧道后，仍可浏览缓存。

尚未生成缓存时，页面会提示先启动同步。
同步正在进行或失败时，预览可能只包含此前保存的消息。

### `list_wechat_sessions`

- `query`：按会话名称或会话 ID 的部分文字查找。
- `limit`：默认 50，最多 200。`offset`：默认 0。
- 返回 `sessions` 和 `nextOffset`；`sessions[].id` 是会话 ID。
- 沿 `nextOffset` 加载更多候选。更换查询时从 0 开始；`nextOffset` 为 null 时没有更多会话。

### `get_wechat_history`

- `session_id`：传入 `sessions[].id`。
- `limit`：默认 50，最多 200。`before`：只接受同一会话上一页返回的 `next`。
- 返回 `session`、`messages` 和 `next`。
- 省略 `before` 时读取最近消息，按时间正序排列。
- 将 `next` 传入 `before` 读取更早消息；`next` 为 null 时没有更早消息。

联系人名称和群名只用于查找会话，不能作为 `session_id`。
同名候选先由用户确认。

`isSelf` 标识当前用户发送的消息；`senderId` 区分其他发送者。

微信引用回复会在 `content` 中展示回复正文与引用内容。
同时提供 `replyContent`、`quotedSender`、`quotedContent` 和 `quotedType`。

图片、语音、视频等引用只标注类型，不包含附件正文。
其他非文本消息只返回类型占位。

## 运行参考

### 数据库密钥补充

钥匙串辅助程序位于 `~/.wechat-history-mcp/native/keychain`。

曾用 TraceMemo 验证该账号时，可在源码目录一次性导入已有密钥。

```sh
node mcp-server/bin/import-tracememo-key.js "/Users/you/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<账号目录>"
```

<details>
<summary>展开运行细节</summary>

### stdio 与历史缓存

MCP 客户端或隧道应启动并保持以下进程：

```sh
wechat-mcp stdio --account-root "/Users/you/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<账号目录>"
```

从源码启动时，可将命令替换为 `node /absolute/path/to/chat-coach/mcp-server/bin/wechat-mcp.js stdio`。

直接在终端运行时，进程会等待 stdin 中的 MCP 请求，不会打开管理页。

历史缓存默认位于 `~/.wechat-history-mcp/accounts/<账号路径哈希>/messages.sqlite`。

- 首次运行：导入全部可读消息。
- 后续运行：监听 `db_storage` 变化，并去重同步。
- 指定缓存：使用 `--data-file /absolute/path/messages.sqlite`。每个账号应使用不同文件。

服务不会自动迁移或删除旧 DSH 缓存和配置，而会自行重新同步。

初始化和工具发现不需要等待全量导入。
查询会等待当前同步完成；首次查询耗时取决于历史量。

同步失败会返回明确错误，不把失败当成空历史。
退出或 stdin 关闭时，服务停止监听并关闭数据库。

可用 `--status-file /absolute/path/sync-status.json` 原子写入本机同步状态、进程信息和统计。
失败信息经过处理。管理后台自动加入此参数，不新增 MCP 工具。

日志仅写 stderr，不含密钥或聊天正文。
除 `--help` 外，stdout 仅用于 MCP 协议。

### 管理后台与诊断

管理页绑定 `127.0.0.1` 的自动分配端口。
浏览器标签页和页头共用绿色 W 图标。页面资源随 npm 包提供，无需联网加载。

访问地址和页面会话令牌保存在 `~/.wechat-history-mcp/manager.json`，仅当前用户可读。
请通过命令打开页面，不共享包含令牌的链接。

接口校验 Host、Origin 和会话令牌，并拒绝跨站请求。
它仅提供固定的启停操作和只读历史缓存查询。

管理后台复用 `${XDG_CONFIG_HOME:-~/.config}/tunnel-client/wechat.yaml`。
若已有 `wechat-history.yaml`，则优先复用旧文件。

配置须包含单个 `main` stdio 通道。
启动命令可使用上文示例中的 `node .../wechat-mcp.js stdio` 格式。

运行密钥使用 `env:变量名` 或 `file:/绝对路径` 引用。
文件引用适合后台运行。

如使用环境变量，须在首次启动管理后台的终端中设置。
管理后台的环境会沿用到服务重启。

更换环境变量后，先运行 `wechat-mcp stop`，再启动服务。

服务从 PATH 查找隧道客户端，也可通过 `TUNNEL_CLIENT_BIN=/绝对路径/tunnel-client` 指定。

后台调用官方 `tunnel-client runtimes connect/status/stop`，确认进程、健康、就绪和 MCP 子进程状态。

首次升级已运行的旧服务后，在管理页点一次“重启”，以启用同步状态报告。
现有隧道 ID、钥匙串和历史缓存会保留。

服务状态每 2 秒刷新。页面显示：

- 同步成功时间、缓存会话和消息数。
- 最近 100 条经过筛选的诊断记录。

状态和诊断记录不包含聊天正文或密钥。
官方隧道诊断页入口仅指向本机地址。

服务停止后，统计会标记为历史数据。
新服务的实时状态不会采用旧进程报告。

缺少配置、客户端或运行密钥时，页面会给出准备步骤。
启动失败时不会显示成功。

缺少微信数据库密钥时，按上文准备密钥，再重启。

### 预览接口

管理后台按已有配置中的默认历史缓存路径或 `--data-file` 打开只读连接。

它不创建或迁移数据库，也不提供编辑、消息全文搜索或附件下载。

本机管理接口沿用上文两个 MCP 工具的参数与返回结构：

- `GET /api/preview/sessions`
- `GET /api/preview/history`

默认每次返回 50 条，最多 200 条。每次读取后，管理后台会关闭连接。

浏览器不能指定数据库路径。
聊天正文按文本显示，不写入状态文件或诊断日志。

### 管理页更新

更新管理页代码后，先运行 `wechat-mcp stop` 退出旧管理后台，再重新启动。

页面中的“重启”只重启微信历史 MCP 与隧道，不能替换已运行的管理后台代码。
从源码验证改动时，停止旧后台后运行 `node mcp-server/bin/wechat-mcp.js`。

第一版仅管理已有单账号配置，不提供配置编辑或开机自启。

测试时可用 `WECHAT_HISTORY_HOME` 隔离管理元数据目录。
该变量不会改变微信历史缓存或钥匙串位置。

### 启停细节

前台命令会在确认后台退出后结束。
启动过程中按 `Ctrl+C`，命令仍会等待启动操作结束，再清理服务。

关闭期间连续按 `Ctrl+C` 不会跳过清理。

再次运行命令会复用同一后台。
任一前台终端按 `Ctrl+C` 都会关闭共享服务；其他前台终端会随后台退出而结束。

管理页提供启动、停止和重启操作。
页面中的“停止”只关闭微信历史 MCP 与隧道，管理后台和前台终端继续运行。

脚本中使用 `wechat-mcp --background --no-open`。
从源码启动时，使用 `node mcp-server/bin/wechat-mcp.js`。
服务调用 macOS 的 `open` 打开默认浏览器。

### 版本兼容与发布

日常管理命令由 `wechat-history` 改为 `wechat-mcp`；不再安装旧命令。
服务仍使用原 `~/.wechat-history-mcp/` 数据目录。

管理页兼容旧 profile 中不带 `stdio` 的 `wechat-mcp` 和 `wechat-history-mcp` 命令。
重启时，管理页会自动使用当前安装包的 `wechat-mcp stdio`。

直接启动 stdio 的客户端需添加 `stdio` 子命令。已有隧道无需重建。

当前包版本以 `mcp-server/package.json` 为准。

PR 合并后，Auto Tag 工作流依据 PR label 更新 `package.json` 和 lockfile，并创建对应 Git tag。
维护者仍需手动运行 **Publish WeChat MCP** 工作流。

发布前可用 `npm run test:package --prefix mcp-server` 验证安装包。
已有版本不可重复发布。

已有「微信历史」应用的显示名可在 ChatGPT 应用设置中修改为 **wechat**。
MCP 服务名不会自动修改应用显示名。

账号权限须实际检查。
本地自动测试不覆盖真实微信、隧道权限或 ChatGPT 端接入。

权限不足时，不自动改为公网服务。

</details>

## 验证

```sh
npm test --prefix mcp-server
npm run test:package --prefix mcp-server
```

<details>
<summary>查看自动测试范围与实机验证步骤</summary>

自动测试使用模拟数据，覆盖：

- stdio 初始化、工具发现与调用、消息分页、同步失败和退出清理。
- 管理页安全校验、只读历史缓存查询、WAL 并发读取和预览搜索分页。
- 过期响应、消息文本转义、滚动位置、手动刷新及错误恢复。
- 重复启动、串行启停、超时、前台信号中断（含启动途中和重复中断）及外部停止。

独立包测试覆盖管理和 stdio 子命令、页面资源及预览接口。
CI 不读取真实微信或 macOS 钥匙串。

### 实机验证

1. 前台启停：
   - 运行 `wechat-mcp`，确认命令保持前台。
   - 按 `Ctrl+C`，确认全部进程退出且管理页端口关闭。再次运行，确认服务可恢复。
2. 后台启停：
   - 运行 `wechat-mcp --background`，确认命令立即返回。
   - 从另一个终端运行 `wechat-mcp stop`，确认服务关闭。
   - 前台命令运行时，也检查外部停止能使其结束。
3. 管理页：
   - 检查状态自动刷新。
   - 停止微信历史 MCP 与隧道后，确认管理页仍可用。再从页面启动和重启服务。
4. 历史预览：
   - 搜索指定联系人，查看近期消息，加载更早历史和更多会话。
   - 核对发送者、时间和非文本占位。
   - 停止服务后，确认预览仍可读取缓存。
5. 增量同步：
   - 重新启动服务并收到新微信消息后，等待同步完成。
   - 手动刷新预览，确认新消息出现。检查窄屏布局。
   - 关闭浏览器后，确认服务仍运行；用 `wechat-mcp stop` 关闭全部后台。
6. ChatGPT 查询：
   - 不启动 DSH，查找指定联系人，读取近期消息并向前翻页。
   - 收到新微信消息后再次读取，确认能看到增量同步的消息。

确认符合预期后，反馈“验证通过”或描述问题。

</details>
