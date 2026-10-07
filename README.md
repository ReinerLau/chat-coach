# chat-coach

克制、自然的中文回复教练，由回复 Skill 和微信历史 MCP 两部分组成。

## 回复 Skill

`skills/chat-reply/SKILL.md` 提供“材料准备 → 回复生成”两层流程。[材料模块](skills/chat-reply/references/materials.md) 优先整理用户已提供的上下文，明确要求或关键材料不足时通过只读微信 MCP 补查，并保留双方信息的来源、时间和缺失；只处理当前任务，不维护长期人物档案。[回复参考](skills/chat-reply/references/naturalness.md) 负责沟通动作、自然表达、停止条件和候选差异。隔离评测流程见 [EVAL.md](skills/chat-reply/EVAL.md)，包含固定回复回归和模拟 MCP 材料层评测。

想通过聊天例子理解这些规则，可以阅读 [规则举例说明](docs/chat-reply-examples.md)：按材料、动作、表达、停止和多候选差异逐条解释，并对照合适与不合适的回复。

想了解评测具体考什么，可以阅读 [测试用例中文阅读版](docs/chat-reply-test-cases.md)：逐题查看聊天上下文、用户需求、考察重点和失败条件。

## 微信历史 MCP

[`mcp-server/`](mcp-server/README.md) 同步本机微信消息，并通过只读工具供 MCP 客户端查找会话、分页读取历史。它不调用模型，也不发送微信消息。安装、隧道配置和运行说明见 [MCP 文档](mcp-server/README.md)。

## 仓库结构

```text
chat-coach/
├── docs/
│   ├── chat-reply-examples.md
│   └── chat-reply-test-cases.md
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
| [docs/chat-reply-test-cases.md](docs/chat-reply-test-cases.md) | 15 个固定测试用例的中文阅读版，说明聊天上下文、用户需求和失败条件。 |
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
