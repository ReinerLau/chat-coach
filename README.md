# chat-coach

chat-coach 包含四个可独立使用的组件：

- **教练 Skill** 根据真实互动辅助判断关系、选择行动、梳理心态，并制定起头或接话的表达要求。如何行动、是否发送由你决定。
- **联系人记录 Skill** 保存联系人背景和互动。
- **拟人 Skill** 根据当前对话中的聊天或背景自然地起头、接话，也可调整自己已生成的消息。
- **微信历史 MCP** 只读查询本机微信历史。

## 使用教练 Skill

通过 `$coach` 显式调用，直接用自然语言说明联系人、互动背景、自己的想法、安排和希望获得的帮助，不需要填写参数。

Skill 在整个交互流程中遵循全部已收录原则，结合真实材料按需选用技巧，给出判断、依据和行动建议；需要起头或接话时，给出一份表达要求，供后续拟写消息使用。不必事先知道方法名称，用户自行决定是否采用建议及发送消息。

### 用法

#### 接话或调整表达要求

贴出聊天或已有草稿，说明希望怎样表达；草稿用于说明意图，教练会整理成表达要求。也可以只要求分析。

```text
$coach 小林说今天又加班到很晚。我已经回了她一句辛苦啦，还想顺着这个话题接一句，轻松一点。
```

#### 查询最近聊天后接话

已接入[微信历史 MCP](mcp-server/README.md)时，可以直接说明联系人，由 Skill 查找最近聊天。

```text
$coach 看看小林最近的消息，帮我想想怎么回。
```

#### 主动开启交流

说明最近的互动和当前想分享的事情，让教练判断是否适合推进关系，并制定起头要求。

```text
$coach 我想主动找小林聊聊。我们上周聊过旧书店，今天我路过城西新开的旧书店，进去逛了二十分钟。
```

#### 判断关系与互动

可以只描述一段互动，请 Skill 分析熟悉程度、双方的主动性和判断依据，无需先有一条待回复消息。

```text
$coach 我和小林认识两个月，单独吃过两次饭，平时大多是我主动，她偶尔也会分享日常。帮我分析一下目前的互动和熟悉程度。
```

#### 决定下一步怎么做

说明已经发生的事情、自己的想法和顾虑，询问当前适合采取什么行动。

```text
$coach 我约了小林两次，她都说最近忙，也没提其他时间。我有点着急，现在适合再约，还是先缓一缓？帮我分析一下。
```

#### 梳理心态与期待

说明让自己纠结的事情和当前判断，请 Skill 帮助核对依据、调整期待。

```text
$coach 她今天还没回消息，我就开始猜是不是没兴趣，想再发一句确认。帮我看看这个判断有没有依据，以及现在适合怎么做。
```

#### 连续追问与调整表达要求

调用后可以直接继续追问，已确认的联系人和同一目标的要求可以沿用，无需每条消息重复写 `$coach`。身份或需求不明确时再澄清。

```text
把表达要求再简短一点，只给要求。
```

```text
她刚回复“最近确实有点忙，等我忙完找你”，帮我看看接下来怎么做。
```

#### 选择技巧与表达要求

进入流程时，Skill 会读取全部原则及其原文和踩坑点，并贯穿后续判断、建议和表达要求；连续交互可复用未变化且仍在上下文中的依据。技巧在符合原则和原文适用前提时按需选用，也可以直接点名技巧或要求不用技巧；没有合适技巧时，仍依照原则及实际材料协助。

可以要求重点解释某项原则，或只要表达要求而不需要解释。输出只说明影响当前判断的依据，无需逐项列出全部原则；只要表达要求时，原则检查仍会完成。

```text
$coach 分析这段聊天，重点解释交流三层次对当前判断的影响，先不用制定表达要求。
```

单独想了解原则或技巧的名称、用途和区别时也可以提问；解释或推荐前会读取对应原文，不凭名称编造方法。

### 遵循的原则

- [镜像原则](skills/coach/references/principles/镜像原则.md)
- [交流三层次](skills/coach/references/principles/交流三层次.md)
- [关系分层升级](skills/coach/references/principles/关系分层升级.md)
- [不能证明是好的，也不要预设它是坏的](skills/coach/references/principles/不能证明是好的，也不要预设它是坏的.md)
- [少问多说，多说自己](skills/coach/references/principles/少问多说，多说自己.md)
- [客观陈述事实](skills/coach/references/principles/客观陈述事实.md)
- [适当表达感受](skills/coach/references/principles/适当表达感受.md)
- [谨慎评价对方](skills/coach/references/principles/谨慎评价对方.md)

### 可用技巧

- [平衡的艺术](skills/coach/references/techniques/平衡的艺术.md)
- [扩大冲突](skills/coach/references/techniques/扩大冲突.md)
- [魔趣法则](skills/coach/references/techniques/魔趣法则.md)
- [行为聊法](skills/coach/references/techniques/行为聊法.md)
- [状态感受切换法](skills/coach/references/techniques/状态感受切换法.md)
- [共情](skills/coach/references/techniques/共情.md)
- [赞美的法则](skills/coach/references/techniques/赞美的法则.md)

完整流程见[教练 Skill](skills/coach/SKILL.md)。普通聊天不会自动调用教练 Skill。

## 使用拟人 Skill

通过 `$humanize` 显式调用，提供聊天或相关背景，请它主动起头或接话。它可独立使用，默认返回一条可直接发送的消息。

```text
$humanize
聊天记录：
小林：今天终于把那本书看完了
我：怎么样？
小林：结尾跟我想的不太一样
```

主动起头也可以只给背景，例如：

```text
$humanize 我想主动找小林聊聊。上周她提过想试试自己做咖喱，我刚在超市看到一种很特别的咖喱块。
```

想调整它刚生成的消息时，再次调用 `$humanize` 说明要求；它会保留仍有效的明确要求。拟人 Skill 只使用当前对话已有的材料，不查询微信历史或联系人档案。完整规则见[拟人 Skill](skills/humanize/SKILL.md)。

需要先判断表达方向时，可在同一对话中先调用 `$coach` 取得表达要求，再调用 `$humanize`。拟人 Skill 会结合当前对话中可见的聊天材料、背景和要求写出消息；它也可独立使用。

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

教练 Skill 与联系人记录 Skill 都已安装时，使用 `$coach` 分析或制定表达要求的过程中，会自动保存新材料里有用的联系人背景和互动，无需另外调用 `$contact-notes`。普通聊天不触发自动记录。

以下内容不会写入档案：

- 表达要求、回复目标、所用原则或技巧、原文和方法踩坑点、模型的分析判断与行动建议。
- 你明确要求本轮或指定范围不记录的信息。

需要本轮跳过记录时，可以在请求中说明：

```text
$coach 帮我分析小林这段话，这轮不用记录。
```

### 同时维护档案与获取建议

同轮显式调用 `$contact-notes` 和 `$coach` 时，先完成指定的记录、修正或删除，再按需要分析或制定表达要求。细节见[自动记录说明](skills/coach/references/auto-notes.md)。

### 档案存放位置

每个联系人对应 `~/.chat-coach/contacts/` 中的一个 Markdown 文件。档案保存背景、当前情况、互动记录和个人观察。

微信历史按需查询，不复制全文到档案。ChatGPT 无法直接读取这些本机文件。

## 安装 Skill

三个 Skill 可以独立安装。用户级 Skill 放在 `~/.agents/skills/`，参见 [Codex 官方 Skill 说明](https://learn.chatgpt.com/docs/build-skills)。

### 首次安装

1. 从仓库 `skills/` 中选择需要安装的 Skill：`coach`、`contact-notes`、`humanize`。
2. 将所选目录的全部受版本控制文件复制到 `~/.agents/skills/` 下的同名目录。
   - 保留 `SKILL.md`、`agents/openai.yaml` 和该目录下的 `references/`（如有）。
   - 无需复制仓库 `docs/`、其他 Skill 或本机 `contacts` 软链。
3. 用 `$coach`、`$contact-notes` 或 `$humanize` 开始使用。新安装的 Skill 未显示时，重启 Codex。

### 更新已安装的 Skill

先保留自己维护的条目、原文和踩坑点，再用新版目录替换，避免旧规则文件残留。教练 Skill 从 `chat-reply` 改名为 `coach`；已安装旧版时，迁移自定义内容后移除 `~/.agents/skills/chat-reply/`，再安装 `coach`，避免两个版本同时出现。

### 只安装一个 Skill

- 只安装教练 Skill：可读取已有联系人档案，但不自行写入联系人档案。首次需要保存联系人信息时，会提示安装联系人记录 Skill；已收录的原则、技巧、原文和踩坑点仍可独立使用。
- 只安装联系人记录 Skill：可独立维护档案。
- 只安装拟人 Skill：可根据你提供的聊天或背景起头、接话，并调整自己已生成的消息，无需安装其他 Skill 或微信历史 MCP。

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

具体文档结构和维护要求见[原则、技巧与原文说明](skills/coach/references/library.md#维护文档)。
