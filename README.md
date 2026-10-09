# chat-coach

chat-coach 由中文回复教练 Skill 和微信历史 MCP 两部分组成。中文回复教练 Skill 根据实际聊天上下文生成自然、有活人感的中文回复。项目术语见 [CONTEXT.md](CONTEXT.md)。

## 中文回复教练 Skill

[中文回复教练 Skill](skills/chat-reply/SKILL.md) 保留任务目标与材料层：结合待回复消息、实际聊天上下文和用户说明生成回复，材料不足时按需读取微信历史或向用户补问。微信会话查找、历史读取和分页用法见 [微信历史读取说明](skills/chat-reply/references/materials.md)。

修改中文回复教练 Skill 后由用户手工测试。[手工测试集](docs/chat-reply-manual-tests.md) 提供 24 个原创虚构场景和空白记录区，供用户观察模型表现。测试数据放在 Skill 外，运行时不引用；后续可将实际遇到的问题追加为回归案例，再据此优化。

## 微信历史 MCP

[`mcp-server/`](mcp-server/README.md) 同步本机微信消息，并通过只读工具供 MCP 客户端查找会话、分页读取历史。它不调用模型，也不发送微信消息。安装、隧道配置和运行说明见 [MCP 文档](mcp-server/README.md)。

## 仓库结构

```text
chat-coach/
├── CONTEXT.md
├── docs/
│   └── chat-reply-manual-tests.md
├── mcp-server/
└── skills/
    └── chat-reply/
        ├── SKILL.md
        └── references/
            └── materials.md
```

| 位置 | 干什么的 |
| --- | --- |
| [CONTEXT.md](CONTEXT.md) | 项目领域术语及同义称呼的取舍。 |
| [docs/chat-reply-manual-tests.md](docs/chat-reply-manual-tests.md) | 可复制的聊天场景与手工测试记录区。 |
| [mcp-server/](mcp-server/README.md) | 微信历史 MCP 的实现、安装、配置与验证说明。 |
| [skills/chat-reply/SKILL.md](skills/chat-reply/SKILL.md) | 中文回复教练 Skill 入口，定义任务目标与上下文使用方式。 |
| [skills/chat-reply/references/materials.md](skills/chat-reply/references/materials.md) | 微信历史 MCP 的查询用法。 |

## 开发与验证

```sh
npm ci --prefix mcp-server
npm test --prefix mcp-server
npm run test:package --prefix mcp-server
```

修改 `skills/chat-reply/**` 后，由用户手工测试。
