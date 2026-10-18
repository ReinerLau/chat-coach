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

`--strategy` 选择整套策略，不能与 `--intent`、`--principle` 或 `--technique` 混用。
自定义组合时，每轮最多选一个意图；原则和技巧可以分别选多个。

```text
$chat-reply 小林 --intent 起头 --context "今天刚参加完比赛，结束后觉得挺有意思，想主动和她聊聊"
$chat-reply 小林 --intent 共情 --principle 非评价式共情 --technique 行为一致
$chat-reply 小林今天刚发来“终于考完了，累死我了”，用共情接话。
```

含义明确的自然语言调用也可以使用。可用名称与适用条件见[输入规则](skills/chat-reply/SKILL.md)和[策略清单](skills/chat-reply/references/strategies/index.md)。

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
