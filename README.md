# chat-coach

chat-coach 由中文回复教练 Skill 和微信历史 MCP 两部分组成。中文回复教练 Skill 以活人感为唯一优化目标。项目术语见 [CONTEXT.md](CONTEXT.md)。

## 中文回复教练 Skill

`skills/chat-reply/SKILL.md` 采用“材料准备 → 回复生成 → AI 痕迹检查”流程，开始时读取并遵循全程约束，每轮只生成一个回复，检查通过后才展示给用户。检查不通过时从头重跑，直到通过；可复用已有聊天材料，重新核对并整理材料摘要，材料充分时无需重复查询微信历史。默认不附带分析或检查过程。

[材料准备参考](skills/chat-reply/references/materials.md) 按需整理已有上下文或通过只读微信历史 MCP 补查，保留来源和时间，只处理当前任务，不维护长期人物档案。回复生成帮助模型生成像普通真人聊天的中文回复建议，尽量减少 AI 痕迹，不以礼貌、稳妥或聊天结果评判好坏。缺少必须由用户提供的事实或态度时先补问，能够直接回复时不额外收集信息。细节见 [自然表达参考](skills/chat-reply/references/naturalness.md) 和 [AI 痕迹检查参考](skills/chat-reply/references/ai-traces.md)。修改 Skill 后由用户手工测试。

想通过聊天例子理解这些规则，可以阅读 [规则举例说明](docs/chat-reply-examples.md)：通过长回复、情绪、追问、补问和检查重跑等场景，对照自然表达与 AI 痕迹。

## 微信历史 MCP

[`mcp-server/`](mcp-server/README.md) 同步本机微信消息，并通过只读工具供 MCP 客户端查找会话、分页读取历史。它不调用模型，也不发送微信消息。安装、隧道配置和运行说明见 [MCP 文档](mcp-server/README.md)。

## 仓库结构

```text
chat-coach/
├── CONTEXT.md
├── docs/
│   └── chat-reply-examples.md
├── mcp-server/
└── skills/
    └── chat-reply/
        ├── SKILL.md
        ├── references/
        │   ├── ai-traces.md
        │   ├── materials.md
        │   ├── naturalness.md
        │   └── prohibitions.md
```

| 位置 | 干什么的 |
| --- | --- |
| [CONTEXT.md](CONTEXT.md) | 项目领域术语及同义称呼的取舍。 |
| [docs/chat-reply-examples.md](docs/chat-reply-examples.md) | 用聊天例子解释回复规则，对照合适与不合适的回复。 |
| [mcp-server/](mcp-server/README.md) | 微信历史 MCP 的实现、安装、配置与验证说明。 |
| [skills/chat-reply/SKILL.md](skills/chat-reply/SKILL.md) | 中文回复教练 Skill 入口，定义活人感目标、生成顺序与事实补问。 |
| [skills/chat-reply/references/naturalness.md](skills/chat-reply/references/naturalness.md) | 自然表达的细节与检查要点。 |

## 开发与验证

```sh
npm ci --prefix mcp-server
npm test --prefix mcp-server
npm run test:package --prefix mcp-server
```

修改 `skills/chat-reply/**` 后，由用户手工测试。
