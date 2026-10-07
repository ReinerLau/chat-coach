# chat-coach

克制、自然的中文回复教练，由回复 Skill 和微信历史 MCP 两部分组成。

## 回复 Skill

`skills/chat-reply/SKILL.md` 提供“材料准备 → 回复生成”两层流程。[材料模块](skills/chat-reply/references/materials.md) 优先整理用户已提供的上下文，明确要求或关键材料不足时通过只读微信 MCP 补查，并保留双方信息的来源、时间和缺失；只处理当前任务，不维护长期人物档案。[回复参考](skills/chat-reply/references/naturalness.md) 负责沟通动作、自然表达、停止条件和候选差异。隔离评测流程见 [EVAL.md](skills/chat-reply/EVAL.md)，包含固定回复回归和模拟 MCP 材料层评测。

## 微信历史 MCP

[`mcp-server/`](mcp-server/README.md) 同步本机微信消息，并通过只读工具供 MCP 客户端查找会话、分页读取历史。它不调用模型，也不发送微信消息。安装、隧道配置和运行说明见 [MCP 文档](mcp-server/README.md)。

## 开发与验证

```sh
npm ci --prefix mcp-server
npm test --prefix mcp-server
npm run test:package --prefix mcp-server
```

修改 `skills/chat-reply/**` 时，按该 Skill 的 EVAL 流程使用独立 Agent 进行 Baseline、Skill 和 Judge 评测。
