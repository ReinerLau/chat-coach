# chat-coach

回复教练：根据对话给出克制、自然的回复建议，并解释一句回复思路。

当前有两种运行方式：

- [微信历史 MCP](mcp-server/README.md)：独立同步本机微信消息，通过私有 MCP 隧道供 ChatGPT 查找会话、读取历史并生成回复建议。npm 包为 `@reinerlau/wechat-mcp`，运行 `wechat-mcp` 打开本机管理页并在前台等待，Ctrl+C 关闭全部服务；`--background` 后台运行；`wechat-mcp stop` 关闭全部后台，`wechat-mcp stdio` 为 stdio 入口。
- 旧版飞书 Bot：运行 `python3 -m chat_coach.bot`，在飞书 1v1 私聊中模拟对话，记录保存在飞书 Bitable。

测试：`python3 -m pytest tests/ -v`；MCP 测试使用 Node.js 22.13+ 执行 `npm test --prefix mcp-server`，安装产物验证使用 `npm run test:package --prefix mcp-server`。
