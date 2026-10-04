# DSH 微信回复教练插件

macOS 微信 4.x 的本地聊天记录由插件读取并同步到独立 SQLite 文件。手机在同一局域网打开 DSH 地址，选择会话后按需生成回复建议。建议和思路仅在响应及当前页面内存中出现，不写入消息库，也不会自动发给微信联系人。

## 环境

- macOS arm64、已登录的微信 4.1.13；Node.js 22.13+；DSH 0.2.0-rc.2。
- 插件附带的 WCDB 库来自 WeFlow，适用其 CC BY-NC-SA 4.0 许可证，详见 `vendor/weflow/LICENSE`。插件运行时不连接 TraceMemo 或 WeFlow 应用。
- 首次接入需要与当前微信账号匹配的 64 位数据库密钥。曾用 TraceMemo 验证过的账号可用下方命令一次性迁移；之后插件只读自己的 macOS 钥匙串项。其他账号可设置 `WECHAT_DB_KEY` 环境变量。

## 安装和配置

在本目录运行 `npm install`。已用 TraceMemo 验证过的账号可执行：

```sh
node bin/import-tracememo-key.js "$HOME/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<账号目录>"
```

迁移会请求 macOS 钥匙串授权，不会打印数据库密钥。若已通过其他方式取得密钥，可运行 `node bin/save-db-key.js <微信账号目录>` 安全输入；也可在启动 DSH 前设置 `WECHAT_DB_KEY`。本插件目前不自动从微信进程提取新密钥。

把本目录安装到 DSH web profile：

```sh
dsh plugin --profile web add /absolute/path/to/chat-coach/dsh-plugin
```

在 `~/.dsh/profiles/web/cordis.patch.yml` 追加：

```yaml
- insert:
    - id: wechat-coach
      name: dsh-plugin-wechat-coach
      config:
        accountRoot: /Users/you/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/<账号目录>
        dataFile: /Users/you/.dsh/wechat-coach/messages.sqlite
        lanHost: 0.0.0.0
        lanPort: 3085
        provider: deepseek-official
        model: deepseek-flash
```

插件首次启动会生成随机访问令牌并存入自己的钥匙串项。运行 `node bin/show-phone-token.js` 查看令牌，手机打开 `http://<电脑局域网IP>:3085/wechat-coach` 后输入。也可使用 `WECHAT_COACH_TOKEN` 环境变量覆盖。DSH 主 Web 服务保持默认的 `127.0.0.1:3080`；插件的 `lanPort` 只开放本插件页面与接口。

## 行为

- 启动后按页导入已有消息，消息数没有人为上限；后续监听 `db_storage` 文件变化，合并事件后增量回读并按会话和本地消息 ID 去重。
- 消息保存在 `dataFile`，会话和消息接口需要访问令牌；建议接口只读最近 30 条消息并调用 DSH 的模型运行时。
- 页面每次只显示当前范围的消息，可向前翻页；生成建议不会进入 SQLite 或 DSH 会话。
- 插件不会发送微信消息，也不会主动向手机推送。

## 验证

```sh
node --test test/*.test.js
```

真实微信验证需先确认能打开数据库，再查看指定联系人的同步消息数，并由用户在手机页面触发一次建议生成。
