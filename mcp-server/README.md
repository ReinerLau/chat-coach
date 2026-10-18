# 微信历史 MCP

`@reinerlau/wechat-mcp` 将本机微信消息同步到按账号隔离的历史缓存。它通过 stdio MCP 提供只读查询。

服务自行同步，无需启动 DSH。它不调用模型，也不发送微信消息。

## 安装

### 运行条件

- macOS arm64、已登录的微信 4.1.13、Node.js 22.13+。其他微信版本尚未实机验证。
- 首次编译钥匙串辅助程序时，需要可用的 `clang`。
- 与当前微信账号匹配的 64 位十六进制数据库密钥。服务不会自动从微信进程提取密钥。

### 选择安装方式

从仓库根目录安装源码依赖：

```sh
npm ci --prefix mcp-server
node mcp-server/bin/wechat-mcp.js --help
```

包发布后，也可从 GitHub Packages 安装。

先按 [GitHub Packages npm 认证说明](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry) 配置：

- `@reinerlau:registry=https://npm.pkg.github.com`
- 具有 `read:packages` 权限的认证。

```sh
npm install -g @reinerlau/wechat-mcp
wechat-mcp --help
```

WCDB 库来自 WeFlow，保留 CC BY-NC-SA 4.0 许可证，见 [vendor/weflow/LICENSE](vendor/weflow/LICENSE)。

### 保存数据库密钥

已有 `chat-coach.wechat-db.v2` macOS 钥匙串项时，无需迁移。

否则，在仓库根目录运行以下命令。按提示输入密钥；输入不会回显。

```sh
node mcp-server/bin/save-db-key.js "/Users/you/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<账号目录>"
```

曾用 TraceMemo 验证该账号时，也可从其已有密钥导入：

```sh
node mcp-server/bin/import-tracememo-key.js "/Users/you/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<账号目录>"
```

也可在启动进程的环境中设置 `WECHAT_DB_KEY`。不要把密钥写入启动参数、隧道命令或文档。

## 接入 ChatGPT

使用 [OpenAI Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) 访问本机 stdio 服务。连接由本机通过出站 HTTPS 发起，无需开放公网端口。

1. 在 ChatGPT 开启开发者模式，并确认可访问 [Platform 隧道设置](https://platform.openai.com/settings/organization/tunnels)。
   - 创建隧道需要 Tunnels Read + Manage；运行和使用需要 Read + Use。
   - 这些权限与 ChatGPT 开发者模式分别检查。
2. 创建隧道，关联到本人使用的 ChatGPT 工作区，并记录 `tunnel_id`。
   - 从设置页或官方 `openai/tunnel-client` 最新 release 安装 `tunnel-client`。
3. 在启动微信历史 MCP 的终端中，为 `tunnel-client` 设置 `CONTROL_PLANE_API_KEY` 环境变量。
   - 微信历史 MCP 不需要模型 API key。不要将实际 key 写进命令示例或仓库。
4. 创建本机 stdio profile。替换账号目录、仓库绝对路径和隧道 ID。以下命令从仓库根目录运行，使用源码版微信历史 MCP。

   ```sh
   tunnel-client init \
     --sample sample_mcp_stdio_local \
     --profile wechat \
     --tunnel-id "tunnel_<你的隧道ID>" \
     --mcp-command 'node "/absolute/path/to/chat-coach/mcp-server/bin/wechat-mcp.js" stdio --account-root "/Users/you/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<账号目录>"'

   tunnel-client doctor --profile wechat --explain
   node mcp-server/bin/wechat-mcp.js
   ```

   全局安装时，将 `--mcp-command` 中的源码命令换成 `wechat-mcp stdio --account-root "<账号目录绝对路径>"`，然后运行 `wechat-mcp`。
5. 在 ChatGPT 创建名为 **wechat** 的私有应用。Connection 选择 **Tunnel** 和对应隧道。
   - stdio 服务依靠隧道权限，无需额外 OAuth。只关联本人需要使用的工作区，不发布到公共目录。
6. 在新对话中启用应用，然后请求读取微信历史。

> 用 wechat 工具查找“小王”，如有多个同名联系人先让我确认。读取最近 50 条消息，再给一条克制自然的回复和一句简短思路。

调用时，电脑须在线，微信数据库须可读，微信历史 MCP 与隧道须保持运行。

服务和历史缓存留在本机。工具返回的消息会进入 ChatGPT 当前对话。

## 启动与停止

完成隧道配置后，可再次启动微信历史 MCP：

- 全局安装：运行 `wechat-mcp`。
- 从源码使用：在仓库根目录运行 `node mcp-server/bin/wechat-mcp.js`。

命令会打开中文管理页，并在终端前台等待。管理页只绑定 `127.0.0.1`。
页面提供启动、停止、重启，以及同步状态和诊断记录。

按 `Ctrl+C` 会关闭微信历史 MCP、隧道和管理后台。关闭浏览器不会停止服务。

也可从另一个终端运行 `wechat-mcp stop`；源码版使用 `node mcp-server/bin/wechat-mcp.js stop`。

- 后台运行：使用 `wechat-mcp --background`，之后用 `wechat-mcp stop` 关闭。
- 不打开浏览器：使用 `wechat-mcp --no-open`。命令仍在前台等待。
- 页面中的“停止”只关闭微信历史 MCP 与隧道；管理页和前台终端继续运行。

请通过命令打开管理页，不要共享包含会话令牌的链接。

## 查看历史

管理页的“聊天数据预览”可以搜索会话名称或会话 ID。会话列表每页 50 条，可继续加载。

选择会话后，可查看最近 50 条消息并加载更早历史。消息按时间正序显示，标注发送者和时间；非文本消息只显示类型占位。

点击“刷新预览”会重新读取当前搜索下的会话列表和选中会话的最近消息，并重置分页。

预览只读取已同步的历史缓存，不触发微信同步。停止微信历史 MCP 与隧道后，仍可浏览缓存。

尚未生成缓存时，页面会提示先启动同步。同步正在进行或失败时，预览可能只包含此前保存的消息。

### `list_wechat_sessions`

按名称或会话 ID 查找会话。

| 参数 | 取值 |
| --- | --- |
| `query` | 可省略；默认列出会话。填写最多 200 字的名称或会话 ID 片段可筛选。 |
| `limit` | 每页 1–200 条，默认 50。 |
| `offset` | 非负整数，默认 0；加载下一页时使用上页的 `nextOffset`。 |

返回 `sessions` 和 `nextOffset`。`sessions[].id` 是会话 ID。
沿 `nextOffset` 加载更多候选；更换查询时从 0 开始。`nextOffset` 为 null 时没有更多会话。

### `get_wechat_history`

按会话 ID 读取消息。

| 参数 | 取值 |
| --- | --- |
| `session_id` | 必填；使用上一步返回的 `sessions[].id`。 |
| `limit` | 每页 1–200 条，默认 50。 |
| `before` | 可省略；填写同一会话上一页返回的 `next` 可读取更早消息。 |

返回 `session`、`messages` 和 `next`。消息按时间正序排列。
将 `next` 传入 `before` 读取更早消息；`next` 为 null 时没有更早消息。

联系人名称和群名只用于查找会话，不能作为 `session_id`。同名候选先由用户确认。

`isSelf` 标识当前用户发送的消息；`senderId` 区分其他发送者。

微信引用回复会在 `content` 中展示回复正文与引用内容，并提供 `replyContent`、`quotedSender`、`quotedContent` 和 `quotedType`。

图片、语音、视频等引用只标注类型，不包含附件正文。其他非文本消息只返回类型占位。

## 使用本地 MCP 客户端

无需 ChatGPT 隧道时，让本地 MCP 客户端启动并保持以下 stdio 命令：

```sh
wechat-mcp stdio --account-root "/Users/you/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<账号目录>"
```

从源码使用时，将 `wechat-mcp` 换成 `node /absolute/path/to/chat-coach/mcp-server/bin/wechat-mcp.js`。

直接在终端运行此命令会等待 stdin 中的 MCP 请求，不会打开管理页。

## 常见问题

- **看不到隧道：**检查工作区关联及 Tunnels Read + Use 权限。
- **调用失败：**运行 `tunnel-client doctor --profile wechat --explain`，查看管理页状态和本机 stderr。
- **缺少数据库密钥：**按上文保存密钥，然后重启微信历史 MCP。
- **更换环境变量：**先停止管理后台，再在新终端设置变量并启动。管理后台会沿用首次启动时的环境。
- **旧客户端配置：**直接启动 stdio 的命令需加入 `stdio` 子命令。已有隧道无需重建。
- **旧应用名称：**已有「微信历史」应用可在 ChatGPT 设置中改名为 **wechat**。服务名不会自动修改应用显示名。

历史缓存默认位于 `~/.wechat-history-mcp/accounts/<账号路径哈希>/messages.sqlite`。每个账号使用独立缓存。
