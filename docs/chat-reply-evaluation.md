# Chat Reply 活人感评测记录

评测日期：2026-10-07（Asia/Shanghai）。本记录对应同步主线材料模块后的最终版本，基于 master 的 `dc2dd37`。固定回复与材料场景版本均为 2。

按 [EVAL.md](../skills/chat-reply/EVAL.md) 使用三个全新、`fork_context=false` 的 Agent，均继承主 Agent 的模型与 reasoning 配置，无单独覆盖。主 Agent 只验证格式、匿名化和汇总，未生成评测候选或参与判分。

## 最终结果

| 评测 | 用例数 | Skill 胜 / 败 / 平 | Skill critical | 门槛 |
| --- | --- | --- | --- | --- |
| 活人感盲评 | 23 | 1 / 0 / 22 | 0 | 通过 |
| 材料层功能 | 18 | 2 / 0 / 16 | 0 | 通过 |

- 三组 JSON 的结构、完整性、回复／补问模式与数量：通过。
- 活人感分数总计：Skill 46 / 46，Baseline 46 / 46。同分时 Judge 可依据具体表达判胜负，不由主 Agent 改分。
- 评测脚本回归：`node --test skills/chat-reply/evals/run-eval.test.mjs`，6 项通过。
- 文档链接、JSON 示例、Skill 符号链接与 `git diff --check`：通过。
- 评测输入在生成与盲评期间的 SHA-256 未变。
- MCP 服务未改动，本地未运行 MCP 测试；材料场景全部使用模拟工具，不读取真实微信历史。

本轮固定回复的 win > loss，观察到一处表达的正向差异；多数用例平局，不能据此推断全面优于基线或对方无法识别 AI。材料分数只验证上下文获取和摘要交接，不评价聊天结果。

同步主线前另跑过 23 个固定回复的初步评测（2 胜 / 0 败 / 21 平）。主线新增材料流程后使用三个新 Agent 重跑了本记录中的全部 41 个场景，初步结果不作为最终版本的验收依据。

## 固定回复逐例结果

评分与胜负来自 Judge；候选相近、长短、情绪、追问及礼貌程度不单独作为奖惩依据。

| 用例 | Skill 活人感 | Baseline 活人感 | Skill 结果 |
| --- | --- | --- | --- |
| material-boundary-arrived | 2 | 2 | 平 |
| action-overload-dinner | 2 | 2 | 平 |
| stop-home | 2 | 2 | 平 |
| casual-sudden-question | 2 | 2 | 平 |
| serious-boundary | 2 | 2 | 平 |
| simple-confirmation | 2 | 2 | 平 |
| low-mood | 2 | 2 | 平 |
| use-explicit-prior-material | 2 | 2 | 胜 |
| polite-refusal-no-excuse | 2 | 2 | 平 |
| do-not-invent-user-details | 2 | 2 | 平 |
| shared-background-no-repetition | 2 | 2 | 平 |
| select-relevant-point | 2 | 2 | 平 |
| candidate-diversity-dinner | 2 | 2 | 平 |
| goodnight-stop | 2 | 2 | 平 |
| accept-apology | 2 | 2 | 平 |
| natural-long-reply | 2 | 2 | 平 |
| emotional-pushback | 2 | 2 | 平 |
| natural-continuation | 2 | 2 | 平 |
| avoid-performed-slang | 2 | 2 | 平 |
| clarify-real-reason | 2 | 2 | 平 |
| clarify-user-stance | 2 | 2 | 平 |
| no-unnecessary-clarification | 2 | 2 | 平 |
| reply-after-clarification | 2 | 2 | 平 |

## 材料层逐例结果

分数为 acquisition、attribution、sufficiency、handoff 四项功能分数之和，满分 8。按材料用例顺序重新匿名映射，单独计算门槛。

| 用例 | Skill 功能分 | Baseline 功能分 | Skill 结果 |
| --- | --- | --- | --- |
| provided-enough | 8 | 8 | 平 |
| fetch-missing | 8 | 8 | 平 |
| explicit-lookup | 8 | 8 | 平 |
| ambiguous-session | 8 | 8 | 平 |
| session-pagination | 8 | 8 | 平 |
| history-pagination | 8 | 8 | 平 |
| history-exhausted | 8 | 8 | 平 |
| error-with-context | 8 | 8 | 平 |
| error-missing | 8 | 8 | 平 |
| empty-history | 8 | 8 | 平 |
| nontext-content | 8 | 8 | 平 |
| current-intent | 8 | 8 | 平 |
| critical-conflict | 8 | 4 | 胜 |
| irrelevant-conflict | 8 | 7 | 胜 |
| reported-information | 8 | 8 | 平 |
| history-instruction | 8 | 8 | 平 |
| mcp-unavailable | 8 | 8 | 平 |
| group-attribution | 8 | 8 | 平 |

## 可复核材料

按 EVAL 约定，原始输出和模拟调用记录留在仓库外，本轮目录：

```text
/var/folders/wj/84f_yly16mjch3q574stvpsh0000gn/T/chat-reply-final-eval-iia93ggc
```

目录中的 baseline.json、skill.json、judge.json 保存原始严格 JSON；baseline/ 和 skill/ 保存模拟器实际调用记录；blind.json 为匿名输入；report.json 为脚本汇总；manifest.json 保存输入 SHA-256、共同生成提示、Judge 提示、Agent 身份与配置。pre-rebase-evaluation.json 保存同步主线前的初步评测记录。

Baseline 只收到过滤后的用例、模拟接口和输出格式；Skill 收到相同内容并读取当前 Skill 和参考。两者均未收到固定回复的预期模式或 failure_conditions，也未读取材料 fixture 的 mocks。Judge 只读取匿名输入和两套 rubric，未读取 Skill 或生成 Agent 身份。
