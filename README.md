# chat-coach

chat-coach 包含三个可独立使用的组件：

- **教练 Skill** 介绍已收录的关系推进技巧、按场景推荐一个技巧，或整理指定技巧的使用要求。
- **拟人 Skill** 按本次调用的要求，结合已有聊天或背景开场、接话，也可改写指定消息；默认给出一条可发送消息。
- **微信历史 MCP** 只读查询本机微信历史。

## 使用教练 Skill

通过 `$coach` 显式调用。教练只使用当前对话中已有的材料，不主动查询微信历史、读取联系人档案或记录背景；它不评价用户行为、处理心态调整，也不生成可发送消息。

### 了解技巧

```text
$coach 目前收录了哪些关系推进技巧？只列名称。
```

```text
$coach 介绍一下已收录的技巧分别适合什么情况。
```

### 根据场景推荐

```text
$coach 我想借上次一起逛书店的话题主动联系小林。根据当前已收录的技巧，推荐一个适合的，并给出具体使用要点。
```

教练默认给出一个技巧、简短理由、适用前提和具体技巧要点；没有合适技巧或关键信息不足时会说明。当前技巧库为空，本次重构不预置技巧；重新收录前不会凭记忆推荐。

### 使用指定技巧

```text
$coach 请按“技巧名称”给出这次接话的使用要求。我忘了具体做法，先查已收录条目，不要写消息。
```

未收录的技巧需要先提供材料并明确要求收录，教练不会凭同名印象补写用法。

## 使用拟人 Skill

通过 `$humanize` 显式调用，在本次请求中说明要怎样表达；此前聊天可作背景，此前的表达要求和语气偏好不自动沿用。拟人不自行查询微信历史或联系人档案。

```text
$humanize
聊天记录：
小林：今天终于把那本书看完了
我：怎么样？
小林：结尾跟我想的不太一样
```

```text
$humanize 我想主动找小林聊聊。上周她提过想试试自己做咖喱，我刚在超市看到一种特别的咖喱块。帮我开场。
```

拟人无需安装教练 Skill。改写时可指定原消息与希望改变的角度、态度或措辞。完整规则见[拟人 Skill](skills/humanize/SKILL.md)。

## 分步使用

需要先了解技巧时，调用 `$coach` 取得要点。之后单独调用 `$humanize`，在这次请求中明确写出想采用的表达要求。微信或第三方 `$goutoujunshi` 已放入当前对话的内容可作为背景材料；第三方 Skill 的规则和记忆由它自行管理。

```text
$coach 我想顺着下面这段聊天自然接一句。从已收录技巧中选一个，并给我具体使用要点，不写消息。
聊天记录：
小林：上次我们看的那家旧书店，这周末有夜场
```

之后另发一条请求，例如：

```text
$humanize 我想顺着小林提到的旧书店夜场，提议周末一起去看看，给她选择的空间。帮我写一条可发送消息。
```

### 可用技巧

当前暂无已收录技巧。后续新增技巧时，在这里直接列出技巧名称及文档链接。

两个 Skill 可独立安装。用户级 Skill 放在 `~/.agents/skills/`，参见 [Codex 官方 Skill 说明](https://learn.chatgpt.com/docs/build-skills)。从仓库 `skills/` 中复制 `coach` 或 `humanize` 的全部受版本控制文件到同名安装目录，保留 `SKILL.md`、`agents/openai.yaml` 和各自的 `references/`（如有）。安装后通过 `$coach` 或 `$humanize` 调用；新安装的 Skill 未显示时重启 Codex。

更新 Skill 时，先保留自己后续收录的技巧，再用新版目录替换，避免旧规则文件残留。

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

## 技巧库迭代维护

仅在用户明确要求时收录、修正或删除技巧。每项技巧保存在教练 Skill 的 `references/techniques/` 下，包含适用条件、具体做法、容易误用之处和来源；首次收录时再创建该目录。修改技巧清单时同步更新上方“可用技巧”列表。正常使用不扫描 `docs/` 中保留的 EPUB。完整规则见[技巧库规则](skills/coach/references/library.md#收录与修正)。
