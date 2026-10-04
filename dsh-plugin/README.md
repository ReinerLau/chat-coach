# DSH 微信回复教练插件

macOS 微信 4.x 的本地聊天记录由插件读取并同步到独立 SQLite 文件。微信教练页面挂在 DSH Web 服务的 `/wechat-coach`，选择会话后按需生成回复建议。手机连接、扫码配对和远程鉴权统一使用 [dsh-pocket](https://github.com/shaobeichen/dsh-pocket)。建议和思路仅在响应及当前页面内存中出现，不写入消息库，也不会自动发给微信联系人。

## 环境

- macOS arm64、已登录的微信 4.1.13；Node.js 22.13+；DSH 0.2.0-rc.2；可用的 `clang`（首次编译钥匙串辅助程序）。手机访问已用 dsh-pocket 2.10.6 验证。
- 插件附带的 WCDB 库来自 WeFlow，适用其 CC BY-NC-SA 4.0 许可证，详见 `vendor/weflow/LICENSE`。插件运行时不连接 TraceMemo 或 WeFlow 应用。
- 首次接入需要与当前微信账号匹配的 64 位数据库密钥。曾用 TraceMemo 验证过的账号可用下方命令一次性迁移；之后插件只读自己的 macOS 钥匙串项。其他账号可设置 `WECHAT_DB_KEY` 环境变量。

## 安装和配置

在本目录运行 `npm install`。已用 TraceMemo 验证过的账号可执行：

```sh
node bin/import-tracememo-key.js "$HOME/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<账号目录>"
```

迁移会请求 macOS 钥匙串授权，不会打印数据库密钥。若已通过其他方式取得密钥，可运行 `node bin/save-db-key.js <微信账号目录>` 安全输入；也可在启动 DSH 前设置 `WECHAT_DB_KEY`。本插件目前不自动从微信进程提取新密钥。

从源码把本目录安装到 DSH web profile：

```sh
dsh plugin --profile web add /absolute/path/to/chat-coach/dsh-plugin
dsh plugin --profile web add dsh-pocket -w
```

发布版只托管在 GitHub Packages。先按 GitHub Packages 的说明给本机 npm/pnpm 配置 `@reinerlau:registry=https://npm.pkg.github.com` 和具有 `read:packages` 权限的认证，再运行：

```sh
dsh plugin --profile web add @reinerlau/dsh-plugin-wechat-coach
dsh plugin --profile web add dsh-pocket -w
```

在 `~/.dsh/profiles/web/cordis.patch.yml` 追加：

```yaml
- insert:
    - id: wechat-coach
      name: '@reinerlau/dsh-plugin-wechat-coach'
      config:
        accountRoot: /Users/you/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<账号目录>
        dataFile: /Users/you/.dsh/wechat-coach/messages.sqlite
        provider: deepseek-official
        model: deepseek-flash
```

从旧版迁移时，删除微信教练配置中的 `lanHost`、`lanPort`、`tokenEnv`。旧的独立访问端口、配对页和 `WECHAT_COACH_TOKEN` 已停用；微信数据库密钥及 `dataFile` 不变。

## 启动与访问

安装或修改配置后重启 DSH：

```sh
dsh web --host 127.0.0.1 --port 3080
```

- 电脑：打开 `http://127.0.0.1:3080/wechat-coach`，直接加载会话。
- 手机：在电脑 DSH 的「设置 → 手机访问」中扫描 Pocket 局域网二维码，输入该页显示的 Pocket 密码。登录后，将地址路径改为 `/wechat-coach`，例如 `http://<电脑局域网 IP>:3081/wechat-coach`，可保存为书签。
- 外出访问：通过 Pocket 设置页开启公网访问；登录公网地址后同样进入 `/wechat-coach`。隧道设置及公网访问说明见 [Pocket 文档](https://github.com/shaobeichen/dsh-pocket#readme)。

本机示例使用 DSH 默认端口 `3080`；已有自定义端口时保留原端口。Pocket 默认端口为 `3081`，以其设置页显示的地址为准。微信教练不再要求单独输入访问令牌。

DSH 必须监听 `127.0.0.1`，插件会拒绝其他绑定方式。教练页面和接口只接受回环连接及本机 Host，并拒绝跨来源浏览器请求；Pocket 验证访问密码后，将请求转发至本机 DSH。Pocket 的局域网密码保持开启；它开放的是整个 DSH，包含 Agent 操作能力。

## 行为

- 启动后按页导入已有消息，消息数没有人为上限；后续监听 `db_storage` 文件变化，合并事件后增量回读并按会话和本地消息 ID 去重。
- 消息保存在 `dataFile`，页面和接口由 DSH 主 Web 服务提供，远程访问由 Pocket 鉴权；建议接口只读最近 30 条消息并调用 DSH 的模型运行时。
- 页面每次只显示当前范围的消息，可向前翻页；生成建议不会进入 SQLite 或 DSH 会话。
- 插件不会发送微信消息，也不会主动向手机推送。

## 验证

```sh
node --test test/*.test.js
```

真实微信验证需先确认能打开数据库，再经 Pocket 在手机打开 `/wechat-coach`、查看指定联系人的同步消息，并由用户触发一次建议生成。未登录 Pocket 时，教练接口应返回 `401`；登录后无需旧版令牌。电脑本机访问不需要 Pocket 登录。
