# Chat Reply Skill Evaluation

这个评测用于验证 `skills/chat-reply/SKILL.md` 是否真的改善中文聊天回复行为，并确保测试过程与修改 Skill 的主 Agent 隔离。

## 隔离要求

每次修改 `skills/chat-reply/**` 后，使用 3 个全新的子 Agent，全部设置 `fork_context=false`，并尽量使用相同模型与 reasoning 配置：

1. **Baseline Agent**：只接收测试用例和输出格式要求。明确禁止读取、加载或引用 `skills/chat-reply/SKILL.md` 及其 references。
2. **Skill Agent**：接收与 Baseline 完全相同的测试用例，并显式加载当前工作区中的 `skills/chat-reply/SKILL.md` 后作答。
3. **Judge Agent**：只接收测试用例、`evals/judge-rubric.md` 和匿名化后的 A/B 输出。禁止读取 Skill，也不能知道 A/B 分别来自哪个 Agent。

主 Agent 只负责调度、匿名化和汇总结果，不生成候选回复，也不参与判分。

仓库默认要求“生成或评审中文聊天回复时使用 chat-reply Skill”。本评测中的 **Baseline Agent 和 Judge Agent 是唯一例外**，否则基线和盲评会被 Skill 污染。

## 输入

固定用例在 `evals/cases.json`。不要在评测前临时改写 case，也不要把 golden reply 或期望措辞加入 case。

Baseline Agent 和 Skill Agent 对每个 case 只返回严格 JSON：

```json
{
  "cases": [
    {
      "case_id": "material-boundary-arrived",
      "replies": ["候选 1"]
    }
  ]
}
```

`replies` 数量必须等于 case 的 `candidate_count`，不要附加解释。

## 匿名化

主 Agent 在交给 Judge 前按 case 在 `cases.json` 中的顺序固定映射：

- 奇数 case：Baseline = A，Skill = B
- 偶数 case：Skill = A，Baseline = B

Judge 只能看到 `case_id`、case 内容、A/B 候选和 rubric。

## Judge 输出

Judge 对每个 case 分别评价 A 和 B。评分维度为：

- `material`
- `action`
- `expression`
- `stop`
- `diversity`

每项 0–2 分，并列出命中的 `failure_conditions`。然后给出 `winner`：`A`、`B` 或 `tie`。材料边界和标记为 `critical: true` 的失败优先级高于语言润色。

Judge 只返回严格 JSON：

```json
{
  "cases": [
    {
      "case_id": "material-boundary-arrived",
      "A": {"scores": {"material": 2, "action": 2, "expression": 2, "stop": 2, "diversity": 2}, "failures": []},
      "B": {"scores": {"material": 2, "action": 2, "expression": 2, "stop": 2, "diversity": 2}, "failures": []},
      "winner": "tie"
    }
  ]
}
```

## 回归门槛

解码 A/B 身份后，当前 Skill 必须同时满足：

1. 所有 Agent 输出都能按约定 JSON 结构解析，case 完整且候选数量正确。
2. Skill 输出命中的 critical failure 数量为 **0**。
3. Skill 相对 Baseline 的 `loss` 数量不超过 **2**。

另外报告 `win / loss / tie`。只有 `win > loss` 时才能声称这次修改带来了正向改进；`win <= loss` 不等于回归失败，但不能宣称 Skill 优于基线。

如果评测不通过，先修复 Skill 或评测资产，然后用 3 个全新的 `fork_context=false` Agent 从头重跑完整流程，不复用旧 Agent 上下文。
