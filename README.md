# chat-coach

chat-coach 包含三个可独立使用的组件：

- **中文回复教练 Skill** 根据真实互动辅助判断关系、选择行动、梳理心态和拟写回复。如何行动、是否发送由你决定。
- **联系人记录 Skill** 保存联系人背景和互动。
- **微信历史 MCP** 只读查询本机微信历史。

## 使用中文回复教练 Skill

通过 `$chat-reply` 显式调用，直接用自然语言说明联系人、互动背景、自己的想法、安排和希望获得的帮助，不需要填写参数。

Skill 在整个交互流程中遵循全部已收录原则，结合真实材料按需选用技巧，给出判断、依据和行动建议；涉及拟写时，通常给出 2–3 条示例。不必事先知道方法名称，用户自行决定是否采用建议、修改和发送。

### 用法

#### 回复或改写已有消息

贴出聊天或已经写好的回复，说明希望怎样表达。也可以只要求分析。

```text
$chat-reply 小林说今天又加班到很晚。我已经回了她一句辛苦啦，还想顺着这个话题接一句，轻松一点。
```

#### 查询最近聊天后回复

已接入[微信历史 MCP](mcp-server/README.md)时，可以直接说明联系人，由 Skill 查找最近聊天。

```text
$chat-reply 看看小林最近的消息，帮我想想怎么回。
```

#### 主动开启交流

说明最近的互动和当前想分享的事情，寻找自然的切入点。

```text
$chat-reply 我想主动找小林聊聊。我们上周聊过旧书店，今天我路过城西新开的旧书店，进去逛了二十分钟。
```

#### 判断关系与互动

可以只描述一段互动，请 Skill 分析熟悉程度、双方的主动性和判断依据，无需先有一条待回复消息。

```text
$chat-reply 我和小林认识两个月，单独吃过两次饭，平时大多是我主动，她偶尔也会分享日常。帮我分析一下目前的互动和熟悉程度。
```

#### 决定下一步怎么做

说明已经发生的事情、自己的想法和顾虑，询问当前适合采取什么行动。

```text
$chat-reply 我约了小林两次，她都说最近忙，也没提其他时间。我有点着急，现在适合再约，还是先缓一缓？帮我分析一下。
```

#### 梳理心态与期待

说明让自己纠结的事情和当前判断，请 Skill 帮助核对依据、调整期待。

```text
$chat-reply 她今天还没回消息，我就开始猜是不是没兴趣，想再发一句确认。帮我看看这个判断有没有依据，以及现在适合怎么做。
```

#### 连续追问与调整回复

调用后可以直接继续追问，已确认的联系人和同一目标的要求可以沿用，无需每条消息重复写 `$chat-reply`。身份或需求不明确时再澄清。

```text
再自然一点，只给一句。
```

```text
她刚回复“最近确实有点忙，等我忙完找你”，帮我看看接下来怎么做。
```

#### 选择技巧与回复形式

进入流程时，Skill 会读取全部原则及其原文和踩坑点，并贯穿后续判断、建议和回复；连续交互可复用未变化且仍在上下文中的依据。技巧在符合原则和原文适用前提时按需选用，也可以直接点名技巧或要求不用技巧；没有合适技巧时，仍依照原则及实际材料协助。

可以要求重点解释某项原则，或只要回复文本而不需要解释。输出只说明影响当前判断的依据，无需逐项列出全部原则；只要聊天文本时，原则检查仍会完成。

```text
$chat-reply 分析这段聊天，重点解释交流三层次对当前判断的影响，先不用拟写回复。
```

单独想了解原则或技巧的名称、用途和区别时也可以提问；解释或推荐前会读取对应原文，不凭名称编造方法。

### 遵循的原则

- [镜像原则](skills/chat-reply/references/principles/镜像原则.md)
- [交流三层次](skills/chat-reply/references/principles/交流三层次.md)
- [关系分层升级](skills/chat-reply/references/principles/关系分层升级.md)

### 可用技巧

- [平衡的艺术](skills/chat-reply/references/techniques/平衡的艺术.md)
- [扩大冲突](skills/chat-reply/references/techniques/扩大冲突.md)
- [魔趣法则](skills/chat-reply/references/techniques/魔趣法则.md)
- [行为聊法](skills/chat-reply/references/techniques/行为聊法.md)
- [状态感受切换法](skills/chat-reply/references/techniques/状态感受切换法.md)
- [共情](skills/chat-reply/references/techniques/共情.md)
- [赞美的法则](skills/chat-reply/references/techniques/赞美的法则.md)

完整流程见[中文回复教练 Skill](skills/chat-reply/SKILL.md)。普通聊天不会自动调用中文回复教练 Skill。

## 使用联系人记录 Skill

用 `$contact-notes` 查看或维护联系人档案。

### 记录或补充联系人信息

```text
$contact-notes 记一下小林的背景：我们是朋友介绍认识的，她在杭州工作。
$contact-notes 补充小林的互动：昨天线下吃饭，她说这两周准备考试，考完再约。
```

### 查看联系人档案

```text
$contact-notes 查看小林的档案。
```

### 修正或删除记录

```text
$contact-notes 修正小林的城市：之前记错了，她在上海。
$contact-notes 删除小林档案中关于城市的信息。
```

### 在回复流程中自动记录

两个 Skill 都已安装时，使用 `$chat-reply` 分析或拟写的过程中，会自动保存新材料里有用的联系人背景和互动，无需另外调用 `$contact-notes`。普通聊天不触发自动记录。

以下内容不会写入档案：

- 示例回复、回复目标、所用原则或技巧、原文和方法踩坑点、模型的分析判断与行动建议。
- 你明确要求本轮或指定范围不记录的信息。

需要本轮跳过记录时，可以在请求中说明：

```text
$chat-reply 帮我分析小林这段话，这轮不用记录。
```

### 同时维护档案与获取建议

同轮显式调用两个 Skill 时，先完成指定的记录、修正或删除，再按需要分析或拟写。细节见[自动记录说明](skills/chat-reply/references/auto-notes.md)。

### 档案存放位置

每个联系人对应 `~/.chat-coach/contacts/` 中的一个 Markdown 文件。档案保存背景、当前情况、互动记录和个人观察。

微信历史按需查询，不复制全文到档案。ChatGPT 无法直接读取这些本机文件。

## 安装 Skill

两个 Skill 可以独立安装。用户级 Skill 放在 `~/.agents/skills/`，参见 [Codex 官方 Skill 说明](https://learn.chatgpt.com/docs/build-skills)。

### 首次安装

1. 从仓库 `skills/` 中选择 `chat-reply`、`contact-notes` 或两者。
2. 将所选目录的全部受版本控制文件复制到 `~/.agents/skills/` 下的同名目录。
   - 保留 `SKILL.md`、`references/` 和 `agents/openai.yaml`。
   - 无需复制仓库 `docs/`、另一个 Skill 或本机 `contacts` 软链。
3. 用 `$chat-reply` 或 `$contact-notes` 开始使用。新安装的 Skill 未显示时，重启 Codex。

### 更新已安装的 Skill

先保留自己维护的条目、原文和踩坑点，再用新版目录替换，避免旧规则文件残留。

### 只安装一个 Skill

- 只安装中文回复教练 Skill：可读取已有联系人档案，但不自行写入联系人档案。首次需要保存联系人信息时，会提示安装联系人记录 Skill；已收录的原则、技巧、原文和踩坑点仍可独立使用。
- 只安装联系人记录 Skill：可独立维护档案。

## 查询微信历史

[微信历史 MCP](mcp-server/README.md) 供 MCP 客户端查找会话、分页读取本机微信历史。它不调用模型，也不发送微信消息。

安装、启动和 ChatGPT 接入步骤见 [MCP 使用说明](mcp-server/README.md)。

## 开发与发布

### 推送主分支与运行 CI

`master` 允许直接提交和推送，也可以通过分支和 PR 集成。推送到 `master` 或向 `master` 提交 PR 时，[CI 工作流](.github/workflows/ci.yml)会运行 MCP 测试和独立包验证。

### 手动更新版本与创建 tag

维护者手动管理 MCP 包版本和 Git tag。在已同步的 `master` 工作区中执行以下步骤；按需要将 `patch` 换成 `minor` 或 `major`。

```sh
npm version patch --no-git-tag-version --prefix mcp-server
git add mcp-server/package.json mcp-server/package-lock.json
git commit -m "chore: bump MCP package version"
MCP_RELEASE_VERSION=$(node -p "require('./mcp-server/package.json').version")
git tag -a "v${MCP_RELEASE_VERSION}" -m "Release v${MCP_RELEASE_VERSION}"
git push origin master "v${MCP_RELEASE_VERSION}"
```

版本号与锁文件一起提交，tag 指向该版本提交。推送 `master` 后，可在 GitHub Actions 查看对应提交的 CI 结果。

### 手动发布 MCP 包

在 GitHub Actions 中打开 [Publish WeChat MCP 工作流](.github/workflows/publish-mcp.yml)，选择 `master` 并点击 **Run workflow**。

工作流从 `master` 检出当前版本，安装依赖、运行 MCP 测试和独立包验证，通过后发布到 GitHub Packages。发布仅由维护者手动触发，每次发包前需准备尚未发布过的版本号和对应 tag。

## 方法库迭代维护

以下事项用于后续迭代方法库，运行时 Skill 会读取已收录的原文和踩坑点作为依据。

### 收录原则、技巧与原文

原则、技巧和原文分别保存在 Skill 的 `references/principles/`、`references/techniques/` 和 `references/sources/` 中。每项原则或技巧独立成文，保存原文引用和踩坑点；原文文档保存指定章节正文及出处，可以被多个条目直接引用。

收录时明确条目名称、所属原则或技巧、书籍和具体章节，并提供可读取的原文来源。提取时保留原文上下文，不把模型总结写成方法规则。正常回复不扫描 EPUB，也不依赖仓库中的书籍文件。

### 保存迭代中的踩坑点

需要长期保留的具体问题与纠正，在明确迭代要求后写入对应原则或技巧文档，保留场景和适用范围。普通不满意反馈用于当前调整；条目或记录归属不明确时先澄清，踩坑点不写进联系人档案。

具体文档结构和维护要求见[原则、技巧与原文说明](skills/chat-reply/references/library.md#维护文档)。
