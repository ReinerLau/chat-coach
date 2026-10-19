# chat-coach

chat-coach 包含三个可独立使用的组件：

- **中文回复教练 Skill** 根据真实聊天提供示例回复。是否发送由你决定。
- **联系人记录 Skill** 保存联系人背景和互动。
- **微信历史 MCP** 只读查询本机微信历史。

## 使用中文回复教练 Skill

通过 `$chat-reply` 显式调用，直接用自然语言说明联系人、聊天背景、自己的想法、安排和希望怎样回复，不需要填写参数。

```text
$chat-reply 看看小林最近的消息，帮我想想怎么回。
```

```text
$chat-reply 小林说今天又加班到很晚。我已经回了她一句辛苦啦，还想顺着这个话题接一句，轻松一点。
```

```text
$chat-reply 我想主动找小林聊聊。我们上周聊过旧书店，今天我路过城西新开的旧书店，进去逛了二十分钟。
```

也可以贴出聊天或已经写好的回复，只要求分析。同一段连续交互中，已确认的联系人和同一目标的要求可以沿用；身份或需求不明确时再澄清。未指定原则或技巧时，直接结合真实材料给建议，通常提供 2–3 条示例。用户自行决定是否修改和发送。

### 可用技巧

- [平衡的艺术](skills/chat-reply/references/techniques/平衡的艺术.md)
- [扩大冲突](skills/chat-reply/references/techniques/扩大冲突.md)
- [魔趣法则](skills/chat-reply/references/techniques/魔趣法则.md)

### 原则、技巧与原文

需要使用某项已收录的原则或技巧时，直接在请求中点名。Skill 会按需读取对应文档、引用的原文和相关踩坑点，不自动为普通语气要求匹配方法。未收录或原文不足时会说明缺口，不凭名称编造方法。

原则、技巧和原文分别放在 Skill 的参考目录中：

- [原则索引](skills/chat-reply/references/principles/index.md)：每项独立成文，保存原文引用和踩坑点。
- [技巧索引](skills/chat-reply/references/techniques/index.md)：每项独立成文，保存原文引用和踩坑点。
- [原文索引](skills/chat-reply/references/sources/index.md)：保存指定章节的原文和出处，同一章节可以被多项引用。

后续可继续指定要添加的原则或技巧，以及《魔鬼沟通学》《魔鬼约会学》《魔鬼聊天术》等来源中的具体章节；提取时保留原文上下文，不把模型总结写成方法规则。正常回复不扫描 EPUB，也不依赖仓库中的书籍文件。

只有明确说“把这个问题记下来”等长期记录要求时，才把具体场景、问题和你的纠正保存到对应原则或技巧文档；普通不满意反馈只用于当前改写。条目或记录归属不明确时先询问，踩坑点不写进联系人档案。

完整流程见[中文回复教练 Skill](skills/chat-reply/SKILL.md)，文档结构与维护方式见[原则、技巧与原文说明](skills/chat-reply/references/library.md)。普通聊天不会自动调用中文回复教练 Skill。

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

- 示例回复、回复目标、所用原则或技巧、原文和方法踩坑点、模型推测。
- 你明确要求本轮或指定范围不记录的信息。

同轮显式调用两个 Skill 时，先完成指定的记录、修正或删除，再提供示例回复。细节见[自动记录说明](skills/chat-reply/references/auto-notes.md)。

每个联系人对应 `~/.chat-coach/contacts/` 中的一个 Markdown 文件。档案保存背景、当前情况、互动记录和个人观察。

微信历史按需查询，不复制全文到档案。ChatGPT 无法直接读取这些本机文件。

## 安装 Skill

两个 Skill 可以独立安装。用户级 Skill 放在 `~/.agents/skills/`，参见 [Codex 官方 Skill 说明](https://learn.chatgpt.com/docs/build-skills)。

1. 从仓库 `skills/` 中选择 `chat-reply`、`contact-notes` 或两者。
2. 将所选目录的全部受版本控制文件复制到 `~/.agents/skills/` 下的同名目录。
   - 保留 `SKILL.md`、`references/` 和 `agents/openai.yaml`。
   - 无需复制仓库 `docs/`、另一个 Skill 或本机 `contacts` 软链。
3. 用 `$chat-reply` 或 `$contact-notes` 开始使用。新安装的 Skill 未显示时，重启 Codex。

更新旧版时，先保留自己维护的条目、原文和踩坑点，再用新版目录替换，避免旧规则文件残留。

- 只安装中文回复教练 Skill：可读取已有联系人档案，但不自行写入联系人档案。首次需要保存联系人信息时，会提示安装联系人记录 Skill；原文、原则、技巧和踩坑点可在本 Skill 内独立维护。
- 只安装联系人记录 Skill：可独立维护档案。

## 查询微信历史

[微信历史 MCP](mcp-server/README.md) 供 MCP 客户端查找会话、分页读取本机微信历史。它不调用模型，也不发送微信消息。

安装、启动和 ChatGPT 接入步骤见 [MCP 使用说明](mcp-server/README.md)。
