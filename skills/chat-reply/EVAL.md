# Chat Reply Skill Evaluation

这个评测用于验证回复行为与材料准备流程，并确保测试过程与修改 Skill 的主 Agent 隔离。每次评测同时运行固定回复回归和独立材料层场景，不调用真实微信 MCP。

## 隔离要求

每次修改 `skills/chat-reply/**` 后，使用 3 个全新的子 Agent，全部设置 `fork_context=false`，并尽量使用相同模型与 reasoning 配置：

1. **Baseline Agent**：只接收测试输入、模拟工具调用说明和输出格式要求。明确禁止读取、加载或引用 `skills/chat-reply/SKILL.md` 及其 references。
2. **Skill Agent**：接收与 Baseline 完全相同的输入和工具说明，并显式加载当前工作区中的 `skills/chat-reply/SKILL.md` 后作答。
3. **Judge Agent**：只接收测试用例、两套 rubric 和匿名化后的 A/B 输出及实际调用记录。禁止读取 Skill，也不能知道 A/B 分别来自哪个 Agent。

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

## 材料层场景与模拟工具

独立场景在 `evals/material-cases.json`，评测规则在 [evals/material-rubric.md](evals/material-rubric.md)。固定回复用例保持原样；新增场景不包含 golden reply。两个作答 Agent 仅取得以下命令输出的材料层输入，不得读取 fixture、模拟器实现、rubric 或对方输出：

```sh
node skills/chat-reply/evals/mock-mcp.mjs --cases
```

为本轮创建仓库外的临时运行目录，给两个 Agent 分配互不相同的 trace 子目录。模拟调用格式如下，参数必须由 Agent 根据任务及已返回结果选择：

```sh
node skills/chat-reply/evals/mock-mcp.mjs <trace-dir> <case-id> list_wechat_sessions '{"query":"小陈"}'
node skills/chat-reply/evals/mock-mcp.mjs <trace-dir> <case-id> get_wechat_history '{"session_id":"wx_chen"}'
```

共同提供工具接口：`list_wechat_sessions` 接受 query（默认空字符串）、limit（默认 50，1–200）、offset（默认 0），返回 sessions 与 nextOffset；`get_wechat_history` 接受 session_id、limit（默认 50，1–200）、before（可省略），返回 session、按时间正序的 messages 与 next。会话的 id 用作 session_id；message 含 isSelf、senderId、createdAt、type、content；before 使用上一页的 next。工具错误返回 isError 与 content。不可用的工具见各 case 的 tools_available。

模拟器自动记录每次调用及返回值到 `<trace-dir>/<case-id>.jsonl`。Agent 只调用模拟器，不直接写入调用记录，也不调用真实 MCP。各 case 独立处理；模拟用例的当前日期为 2026-10-07、时区 Asia/Shanghai。

材料层每个 case 返回：

```json
{
  "case_id": "provided-enough",
  "summary": {
    "target_message": "待回复消息或 null",
    "user_goal": "用户本轮目标或 null",
    "relevant_messages": [{"speaker": "发送者", "content": "原文", "source": "消息 ID 或用户提供的聊天", "time": null}],
    "user_information": [],
    "other_information": [],
    "gaps": [],
    "conflicts": [],
    "read_status": "not_needed"
  },
  "outcome": "ready",
  "clarification": null,
  "replies": ["候选回复"]
}
```

三种信息数组均使用 speaker、content、source、time 四个字段；time 为提供的时间字符串、工具时间戳或未提供时的 null。read_status 为 not_needed、ok、empty、error 或 unavailable。outcome 为 ready 时按 candidate_count 返回回复，clarification 为 null；需要向用户澄清时为 clarify，replies 为空数组，clarification 写明待补充内容。

两个作答 Agent 的最终 JSON 顶层同时包含 `cases`（原固定输出格式）和 `material_cases`。摘要展示仅用于检查材料交接，不改变 Skill 默认输出。

## 匿名化

主 Agent 在交给 Judge 前按 case 在 `cases.json` 中的顺序固定映射：

- 奇数 case：Baseline = A，Skill = B
- 偶数 case：Skill = A，Baseline = B

Judge 只能看到 `case_id`、case 内容、A/B 候选和 rubric。

材料层按自身用例顺序重新从奇数映射开始；Judge 另见 A/B 摘要、澄清与模拟器实际调用记录，不见运行目录或 Agent 身份。

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

完整 Judge 输出顶层同时包含 `cases` 和 `material_cases`；后者格式相同，评分维度改为材料 rubric 中的 acquisition、attribution、sufficiency、handoff。

## 结果校验与汇总

将两个作答 Agent 的最终 JSON 分别存为运行目录内的 baseline.json 与 skill.json；trace 子目录分别为 baseline/ 与 skill/。主 Agent 执行：

```sh
node skills/chat-reply/evals/run-eval.mjs prepare <run-dir>
```

脚本检查完整性、候选数量和摘要结构，并生成 blind.json。Judge 只读取 blind.json 和两套 rubric，将最终 JSON 保存为 judge.json 后执行：

```sh
node skills/chat-reply/evals/run-eval.mjs report <run-dir>
```

脚本校验评分结构和 failure ID，解码身份，生成 report.json。运行目录和原始模拟输出留在仓库外；记录汇总时注明用例数量、门槛和模拟工具的验证范围。

## 回归门槛

解码 A/B 身份后，当前 Skill 必须同时满足：

1. 所有 Agent 输出都能按约定 JSON 结构解析，case 完整且候选数量正确。
2. Skill 输出命中的 critical failure 数量为 **0**。
3. Skill 相对 Baseline 的 `loss` 数量不超过 **2**。

固定回复回归和材料层场景分别满足以上门槛，不用一组的胜场抵消另一组的失败。材料层还需通过摘要结构检查，其工具调用行为由 Judge 依据真实模拟调用记录判断。

另外报告 `win / loss / tie`。只有 `win > loss` 时才能声称这次修改带来了正向改进；`win <= loss` 不等于回归失败，但不能宣称 Skill 优于基线。

如果评测不通过，先修复 Skill 或评测资产，然后用 3 个全新的 `fork_context=false` Agent 从头重跑完整流程，不复用旧 Agent 上下文。
