# chat-coach

chat-coach 包含三个可独立使用的组件：

- **中文回复教练 Skill** 根据真实聊天提供示例回复。是否发送由你决定。
- **联系人记录 Skill** 保存联系人背景和互动。
- **微信历史 MCP** 只读查询本机微信历史。

## 使用中文回复教练 Skill

把联系人名写在 `$chat-reply` 后面。未指定回复方式时，默认使用“接话”策略。

```text
$chat-reply 小林
$chat-reply 小林 --strategy 共情 --context "我已经回了她一句辛苦啦，想顺着加班的话题再接一句"
```

### 参数

| 参数 | 填什么 | 作用 |
| --- | --- | --- |
| `<联系人名>` | 必填，紧跟 `$chat-reply` | 指定本轮交流对象。 |
| `--strategy` | 下表中的一套策略 | 最多一次；选定整套意图、原则和技巧，不能与下列三项混用。 |
| `--intent` | 下表中的一个意图 | 指定本轮要做什么；最多一次。 |
| `--principle` | 所选意图允许的原则 | 可重复填写不同原则。 |
| `--technique` | 所选意图允许的技巧 | 可重复填写不同技巧。 |
| `--context` | 非空的本轮说明 | 最多一次；补充近况、想法或限制，有空格时加引号。 |

所有命名参数都放在联系人名之后，顺序不限。同一原则或技巧不要重复选。

### 意图与策略

意图说明本轮要完成的交流行为。一轮只选一个；未指定时用“接话”。

| 意图 | 什么时候选 |
| --- | --- |
| 接话 | 根据对方待回复的内容继续交流；话题结束时不硬续。 |
| 共情 | 回应对方具体处境与感受。 |
| 赞美 | 肯定对方明确做过的事，以及你由此产生的感受。 |
| 邀约 | 回应对方对线下见面邀约提出的顾虑。 |
| 起头 | 根据真实近况或近期互动主动开场。 |

`--strategy` 可选以下六套策略。每套包含预定的意图、原则和技巧；[策略清单](skills/chat-reply/references/strategies/index.md)列出完整组成。

| 策略 | 意图 | 什么时候选 |
| --- | --- | --- |
| 接话 | 接话 | 默认选择，先回应对方当前内容。 |
| 起头 | 起头 | 有真实切入点，想主动开场。 |
| 共情 | 共情 | 想认真回应对方的处境与感受。 |
| 轻松共情 | 共情 | 对方情绪较轻，双方也能接玩笑。 |
| 赞美 | 赞美 | 有具体、可核对的行为可肯定。 |
| 邀约 | 邀约 | 对方已对线下见面邀约提出顾虑。 |

只写 `--intent` 时，使用同名策略；“轻松共情”须用 `--strategy` 明确选择。
`--intent` 与原则或技巧同写时，只使用点名的组合。
只写原则或技巧时，以“接话”策略为基础。

### 原则

原则是判断示例回复如何完成意图的标准。以下名称可填在 `--principle` 后面。

| 原则 | 可用于 | 作用 |
| --- | --- | --- |
| [先接内容](skills/chat-reply/references/intents/reply/principles/respond-to-content.md) | 接话 | 先处理对方实际说的内容、问题或约定。 |
| [非评价式共情](skills/chat-reply/references/intents/empathy/principles/non-evaluative-empathy.md) | 共情 | 贴近具体处境回应，不只复述或评价情绪。 |
| [避免比较转移](skills/chat-reply/references/intents/empathy/principles/avoid-comparison.md) | 共情 | 不比惨，也不把话题转成自己的故事。 |
| [具体赞美](skills/chat-reply/references/intents/praise/principles/specific-praise.md) | 赞美 | 根据对方明确做过的事表达感谢或感受。 |
| [先理解顾虑](skills/chat-reply/references/intents/invitation/principles/understand-concern.md) | 邀约 | 先理解对方对见面的具体担心，不催促。 |
| [事实有据](skills/chat-reply/references/shared/principles/grounded-facts.md) | 全部意图 | 不把旧打算或推测写成确定事实。 |
| [尊重边界](skills/chat-reply/references/shared/principles/respect-boundaries.md) | 全部意图 | 对方拒绝或要求停止时收住。 |
| [把握分寸](skills/chat-reply/references/shared/principles/calibrate-intensity.md) | 全部意图 | 按关系和回应幅度调整长度与亲近感。 |
| [不评价对方](skills/chat-reply/references/shared/principles/avoid-labeling.md) | 全部意图 | 不把推测写成对方的情绪或性格标签。 |

### 技巧

技巧是具体的表达方法。以下名称可填在 `--technique` 后面；选用时还须符合当下场景。

| 技巧 | 可用于 | 怎么用 |
| --- | --- | --- |
| [行为聊法](skills/chat-reply/references/intents/reply/techniques/behavior-chat.md) | 接话 | 先接对方内容，再说由此引出的具体行动兴趣。 |
| [扩大冲突](skills/chat-reply/references/intents/reply/techniques/expand-conflict.md) | 接话 | 对方先轻度调侃时，顺着原话做一小步玩笑式反驳。 |
| [行为一致](skills/chat-reply/references/intents/empathy/techniques/behavioral-alignment.md) | 共情 | 有共同处境时，用共同动作表达站在同一边。 |
| [夸张引申](skills/chat-reply/references/intents/empathy/techniques/absurd-extension.md) | 共情 | 轻松且能开玩笑时，把同一情境夸张到明显不可能。 |
| [平衡](skills/chat-reply/references/shared/techniques/balance.md) | 接话、赞美、起头 | 真实肯定后，接一个与当前事情相关的轻微转折。 |
| [状态感受切换法](skills/chat-reply/references/shared/techniques/state-feeling-switch.md) | 接话、起头 | 从有依据的近况或状态，转到轻量的主观感受。 |
| [魔趣法则](skills/chat-reply/references/shared/techniques/moqu.md) | 接话、起头 | 借双方已有联系点，加入明显是假想的夸张动作。 |

例如，想自选共情的原则和技巧，可写：

```text
$chat-reply 小林 --intent 共情 --principle 非评价式共情 --technique 行为一致 --context "她说早上太冷不想起床，我们都在等公交"
```

“夸张引申”只用于共情；单独填写时不会把默认的“接话”改成共情。
`--mode`、`--strategy 普通回应` 和把技巧名填在 `--strategy` 后面都无效。

含义明确的自然语言调用也可以使用。完整输入规则见[中文回复教练 Skill](skills/chat-reply/SKILL.md)。

中文回复教练 Skill 只接受手动调用。普通聊天不会自动调用它。

## 使用联系人记录 Skill

用 `$contact-notes` 查看或维护联系人档案。

```text
$contact-notes 记一下小林的背景：我们是朋友介绍认识的，她在杭州工作。
$contact-notes 补充小林的互动：昨天线下吃饭，她说这两周准备考试，考完再约。
$contact-notes 修正小林的城市：之前记错了，她在上海。
$contact-notes 删除小林档案中关于城市的信息。
$contact-notes 查看小林的档案。
```

两个 Skill 都已安装时，联系人记录 Skill 也会在回复流程中保存新材料里的有用增量。普通聊天不触发自动记录。

以下内容不会写入档案：

- 示例回复、所选策略和模型推测。
- 你明确要求本轮或指定范围不记录的信息。

同轮显式调用两个 Skill 时，先完成指定的记录、修正或删除，再提供示例回复。细节见[自动记录说明](skills/chat-reply/references/auto-notes.md)。

每个联系人对应 `~/.chat-coach/contacts/` 中的一个 Markdown 文件。档案保存背景、当前情况、互动记录和个人观察。

微信历史按需查询，不复制全文到档案。ChatGPT 无法直接读取这些本机文件。

## 安装 Skill

两个 Skill 可以独立安装。用户级 Skill 放在 `~/.agents/skills/`，参见 [Codex 官方 Skill 说明](https://learn.chatgpt.com/docs/build-skills)。

1. 从仓库 `skills/` 中选择 `chat-reply`、`contact-notes` 或两者。
2. 将所选目录的全部受版本控制文件复制到 `~/.agents/skills/` 下的同名目录。
   - 保留 `SKILL.md`、`references/` 和 `agents/openai.yaml`。
   - 安装 `chat-reply` 时，还要保留 `scripts/selection.py`。
   - 无需复制仓库 `docs/`、另一个 Skill 或本机 `contacts` 软链。
3. 用 `$chat-reply` 或 `$contact-notes` 开始使用。新安装的 Skill 未显示时，重启 Codex。

- 只安装中文回复教练 Skill：可读取已有档案，但不自行写入。首次需要保存时，会提示安装联系人记录 Skill。
- 只安装联系人记录 Skill：可独立维护档案。

## 查询微信历史

[微信历史 MCP](mcp-server/README.md) 供 MCP 客户端查找会话、分页读取本机微信历史。它不调用模型，也不发送微信消息。

安装、启动和 ChatGPT 接入步骤见 [MCP 使用说明](mcp-server/README.md)。
