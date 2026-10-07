# chat-coach

以活人感为唯一优化目标的中文回复教练，由回复 Skill 和微信历史 MCP 两部分组成。

## 回复 Skill

`skills/chat-reply/SKILL.md` 保留“材料准备 → 回复生成”两层流程。[材料模块](skills/chat-reply/references/materials.md) 按需整理已有上下文或通过只读微信 MCP 补查，保留来源和时间，只处理当前任务，不维护长期人物档案。回复生成帮助模型生成像普通真人聊天的中文回复建议，尽量减少 AI 痕迹，不以礼貌、稳妥或聊天结果评判好坏。缺少必须由用户提供的事实或态度时先补问，能够直接回复时不额外收集信息。细节见 [自然表达参考](skills/chat-reply/references/naturalness.md)，隔离评测流程见 [EVAL.md](skills/chat-reply/EVAL.md)，包含活人感盲评和模拟 MCP 材料层评测。

想通过聊天例子理解这些规则，可以阅读 [规则举例说明](docs/chat-reply-examples.md)：通过长回复、情绪、追问、补问和多个候选等场景，对照自然表达与 AI 痕迹。

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
| [skills/chat-reply/SKILL.md](skills/chat-reply/SKILL.md) | 回复 Skill 入口，定义活人感目标、生成顺序与事实补问。 |
| [skills/chat-reply/EVAL.md](skills/chat-reply/EVAL.md) | Baseline、Skill、Judge 隔离评测流程与回归门槛。 |
| [skills/chat-reply/references/naturalness.md](skills/chat-reply/references/naturalness.md) | 自然表达的细节与检查要点。 |
| [skills/chat-reply/evals/cases.json](skills/chat-reply/evals/cases.json) | 固定评测用例、回复或补问模式、数量与失败条件。 |
| [skills/chat-reply/evals/judge-rubric.md](skills/chat-reply/evals/judge-rubric.md) | 活人感单项盲评与用户事实约束的判定规则。 |

## 开发与验证

```sh
npm ci --prefix mcp-server
npm test --prefix mcp-server
npm run test:package --prefix mcp-server
```

修改 `skills/chat-reply/**` 时，按该 Skill 的 EVAL 流程使用独立 Agent 进行 Baseline、Skill 和 Judge 评测。
