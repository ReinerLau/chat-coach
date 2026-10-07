# chat-coach

克制、自然的中文回复教练，由回复 Skill 和微信历史 MCP 两部分组成。

## 回复 Skill

`skills/chat-reply/SKILL.md` 为模型提供中文聊天回复建议的判断规则，强调依据对话材料、一次只做必要动作、贴合语气并及时停止。细节见 [自然表达参考](skills/chat-reply/references/naturalness.md)，隔离评测流程见 [EVAL.md](skills/chat-reply/EVAL.md)。

想通过聊天例子理解这些规则，可以阅读 [规则举例说明](docs/chat-reply-examples.md)：按材料、动作、表达、停止和多候选差异逐条解释，并对照合适与不合适的回复。

## 微信历史 MCP

[`mcp-server/`](mcp-server/README.md) 同步本机微信消息，并通过只读工具供 MCP 客户端查找会话、分页读取历史。它不调用模型，也不发送微信消息。安装、隧道配置和运行说明见 [MCP 文档](mcp-server/README.md)。

## 仓库结构

```text
chat-coach/
├── docs/
│   └── chat-reply-examples.md
├── mcp-server/
└── skills/
    └── chat-reply/
        ├── SKILL.md
        ├── EVAL.md
        ├── references/
        │   └── naturalness.md
        └── evals/
            ├── cases.json
            └── judge-rubric.md
```

| 位置 | 干什么的 |
| --- | --- |
| [docs/chat-reply-examples.md](docs/chat-reply-examples.md) | 用聊天例子解释回复规则，对照合适与不合适的回复。 |
| [mcp-server/](mcp-server/README.md) | 微信历史 MCP 的实现、安装、配置与验证说明。 |
| [skills/chat-reply/SKILL.md](skills/chat-reply/SKILL.md) | 回复 Skill 入口，定义材料、动作、表达与停止规则。 |
| [skills/chat-reply/EVAL.md](skills/chat-reply/EVAL.md) | Baseline、Skill、Judge 隔离评测流程与回归门槛。 |
| [skills/chat-reply/references/naturalness.md](skills/chat-reply/references/naturalness.md) | 自然表达的细节与检查要点。 |
| [skills/chat-reply/evals/cases.json](skills/chat-reply/evals/cases.json) | 固定评测用例、候选数量与失败条件。 |
| [skills/chat-reply/evals/judge-rubric.md](skills/chat-reply/evals/judge-rubric.md) | 盲评的评分维度与判定规则。 |

## 开发与验证

```sh
npm ci --prefix mcp-server
npm test --prefix mcp-server
npm run test:package --prefix mcp-server
```

修改 `skills/chat-reply/**` 时，按该 Skill 的 EVAL 流程使用独立 Agent 进行 Baseline、Skill 和 Judge 评测。
