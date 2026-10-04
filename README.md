# chat-coach

回复教练：根据对话给出克制、自然的回复建议，并解释一句回复思路。

当前有两种运行方式：

- [DSH 微信插件](dsh-plugin/README.md)：同步本机微信消息到 SQLite；通过 DSH 的微信教练页面按需生成建议，手机访问使用 dsh-pocket。建议不留记录，也不自动发送。
- 旧版飞书 Bot：运行 `python3 -m chat_coach.bot`，在飞书 1v1 私聊中模拟对话，记录保存在飞书 Bitable。

测试：`python3 -m pytest tests/ -v`；插件测试使用 Node.js 22.13+ 执行 `node --test dsh-plugin/test/*.test.js`。
