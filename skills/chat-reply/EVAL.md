# Chat Reply Skill Evaluation

验证当前 Skill 是否改善中文聊天回复的活人感，并检查是否代填用户事实。每轮同时运行固定回复回归和独立材料层功能评测，不调用真实微信 MCP。不评价聊天效果，也不能据此声称“保证对方无法识别 AI”。

## 隔离要求

每次修改 `skills/chat-reply/**` 后，使用 3 个全新的子 Agent，全部设置 `fork_context=false`，尽量使用相同模型与 reasoning 配置：

1. **Baseline Agent**：只接收测试用例、模拟工具接口和输出格式要求。明确禁止读取、加载或引用 Skill、references、举例文档和 Judge rubric。
2. **Skill Agent**：接收完全相同的用例、模拟工具接口和输出格式要求，并显式加载当前工作区的 [SKILL.md](SKILL.md)，按其中指针读取参考。
3. **Judge Agent**：只接收测试用例、[judge-rubric.md](evals/judge-rubric.md) 和匿名化后的 A/B 输出；材料层另提供 material-rubric 与模拟器的实际调用记录。禁止读取 Skill、references、举例文档和生成 Agent 的身份。

主 Agent 只负责调度、格式验证、匿名化和汇总，不生成候选回复，也不参与判分。Baseline 和 Judge 是仓库“生成或评审中文聊天回复时使用 chat-reply Skill”要求的例外。

## 固定输入与生成输出

固定用例在 [cases.json](evals/cases.json)。用例版本变更应在评测启动前完成；评测期间不得为了通过而调整输入，也不要加入 golden reply 或期望措辞。修复 Skill 后仍用同一组固定用例重跑；用例本身有错误时先记录原因并更新版本，再重新开始整个评测。

每个 case 声明 `expected_mode`（`reply` 或 `clarify`）、`candidate_count`、`question_count`。这三项是验收信息，**不交给生成 Agent**，以验证它会自行判断直接回复还是先向用户补问。生成 Agent 只接收每个 case 的 `id`、`context` 和 `request`；数量需求写在 request 中。也不传 focus 或 failure_conditions，以免泄露判分规则。

两位生成 Agent 收到相同的输出格式要求：

- 每个 case 只生成可发送的回复，或先向用户补问关键事实；两者不能同时出现。
- 每个输出都包含 `case_id`、`replies`、`questions`；未使用的列表为空。
- 不附加解释，只返回严格 JSON：

```json
{
  "cases": [
    {"case_id": "arrived", "replies": ["候选 1"], "questions": []},
    {"case_id": "clarify-real-reason", "replies": [], "questions": ["向用户补问的问题"]}
  ],
  "material_cases": []
}
```

最终 JSON 顶层同时包含 `cases` 和 `material_cases`，两组各自完整（示例只展示部分 case）。主 Agent 验证 case 按用例顺序完整且唯一、三个字段的类型、输出模式及两类列表的数量。澄清用例的候选数为 0，问题数为 1；直接回复用例的问题数为 0。

## 材料层场景与模拟工具

独立场景在 `evals/material-cases.json`，评测规则在 [evals/material-rubric.md](evals/material-rubric.md)。材料用例不包含 golden reply；材料版本变更也必须在评测前完成。两个作答 Agent 仅取得以下命令输出的材料层输入，不得读取 fixture、模拟器实现、rubric 或对方输出：

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

两个作答 Agent 的最终 JSON 顶层同时包含 `cases`（含 replies 和 questions）和 `material_cases`。摘要展示仅用于检查材料交接，不改变 Skill 默认输出。

材料评分 acquisition、attribution、sufficiency、handoff 只验证上下文获取、来源、缺口处理和摘要交接是否正确，不是聊天质量的优化目标。日常猜测不进入事实摘要，但可以用试探语气出现在回复里，不因此判失败。材料层 critical 保留工具调用、事实归属和缺口处理的功能门槛；与固定回复的用户事实 critical 分开汇总。

材料层按自身用例顺序重新从奇数映射开始。Judge 另见 A/B 摘要、clarification 与模拟器实际调用记录，不见运行目录或 Agent 身份。材料 Judge 输出项仍为 `case_id`、A/B 的 `scores` 和 `failures`、`winner`，四项功能分数均为 0–2；顶层与固定回复判分一起包含 `cases` 和 `material_cases`。

## 匿名化与 Judge 输出

主 Agent 按 cases.json 的顺序固定映射：

- 奇数 case：Baseline = A，Skill = B。
- 偶数 case：Skill = A，Baseline = B。

Judge 只能看到 case_id、完整 case、A/B 的 replies 和 questions，以及 rubric。每组只评 `human_likeness`（0–2），附 `reason` 和命中的 `failures`；winner 为 `A`、`B` 或 `tie`。

```json
{
  "cases": [
    {
      "case_id": "arrived",
      "A": {"human_likeness": 2, "reason": "可见表达的判断依据", "failures": []},
      "B": {"human_likeness": 1, "reason": "可见表达的判断依据", "failures": []},
      "winner": "A"
    }
  ],
  "material_cases": []
}
```

主 Agent 验证 Judge case 完整且唯一，分数为 0–2 的整数，reason 非空，failure id 来自对应 case，winner 为合法枚举，然后解码身份汇总。主 Agent 不修改 Judge 的判分。

## 结果校验与汇总

将两个作答 Agent 的最终 JSON 分别存为运行目录内的 baseline.json 与 skill.json；trace 子目录分别为 baseline/ 与 skill/。主 Agent 执行：

```sh
node skills/chat-reply/evals/run-eval.mjs prepare <run-dir>
```

脚本检查完整性、候选数量和摘要结构，并生成 blind.json。Judge 只读取 blind.json 和两套 rubric，将最终 JSON 保存为 judge.json 后执行：

```sh
node skills/chat-reply/evals/run-eval.mjs report <run-dir>
```

脚本校验评分结构和 failure ID，解码身份，生成 report.json。材料层分页失败还会与模拟器调用记录交叉校验：若已用用例指定的会话和游标成功读到配置的上一页内容，Judge 不得标记 `miss-older`；出现矛盾时脚本拒绝该报告，需由 Judge 根据盲评输入和调用记录修正判分。运行目录内的 JSON 和模拟调用记录留在仓库外，作为内部校验材料。

## 会话评测报告

主 Agent 完成结果校验后，直接在当前会话中输出中文评测报告，供用户临时查看；不创建 Markdown 报告文件，不将报告提交到仓库。报告包含：

- **总体结论**：是否通过回归门槛；固定回复和材料层分别列出用例数量、`win / loss / tie`、Skill 命中的 critical failure 数量及门槛判断。
- **逐用例结果**：按两组分开列出 case ID、解码后的 Baseline/Skill 胜负、双方各维度评分，以及命中的 failure ID 和用例中的说明；标明 critical 项，无失败项时写“无”。
- **改进判断**：按组依据 `win > loss` 判断是否有相对基线的正向改进，与“通过回归门槛”分开表述。
- **验证范围**：说明材料层依据模拟工具的实际调用记录评测，不涉及真实微信同步、管理页或真实 MCP 查询。

报告只汇总已校验输出和 Judge 的评分，主 Agent 不新增判分或推测性解释。原始回复、材料摘要和工具记录不全文嵌入会话报告。

评测失败时也输出上述报告；若评测中断或输出校验失败，报告说明中断环节、错误和缺失结果，明确标记“未完成”，只展示已确认的数据，不将缺失结果记作零或宣称通过。每轮重跑后分别报告该轮结果，不用后续结果覆盖此前失败或中断。
## 回归门槛与报告

固定回复回归与材料层场景分别满足门槛，不用一组的胜场抵消另一组的失败。固定回复 Skill 必须同时满足：

1. 所有输出均符合上述格式，case 完整且数量和模式正确。
2. Skill 命中的用户事实 critical failure 数量为 **0**。
3. Skill 相对 Baseline 的 `loss` 不超过 **2**。

材料层也必须结构正确、critical 为 0、loss 不超过 2。分别报告 `win / loss / tie`、critical 数量、格式验证结果和本轮输入版本。只有 `win > loss` 才能声称观察到活人感的正向改进；否则即使通过回归门槛，也不能宣称优于基线。

评测不通过时先修复 Skill 或有错误的评测资产，再使用 3 个全新的隔离 Agent 从头重跑，不复用旧 Agent 上下文。未达门槛不得提交 PR。

评测脚本自身的格式校验与汇总回归可执行：

```sh
node --test skills/chat-reply/evals/run-eval.test.mjs
```
