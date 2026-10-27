# chat-coach

chat-coach 包含两个可独立使用的组件：

- **教练 Skill** 根据当前对话材料拟写回应或主动开场等可发送消息，或改写用户明确指定的消息；按需介绍、推荐或使用已收录的关系推进技巧。
- **微信历史 MCP** 只读查询本机微信历史。

## 使用教练 Skill

通过 `$coach` 显式调用。教练只使用当前对话中已有的材料，不主动查询微信历史、读取联系人档案或记录背景；它不评价用户行为，也不处理心态调整。

用户自行识别推进关系的机会，再主动要求推荐或使用技巧拟写消息。技巧用于推进关系；[通用语言模式](skills/coach/references/expression.md)用于所有拟写或改写的可发送消息，减少表达失误和关系降级的风险。所用技巧有专属语言模式时，还会叠加该模式。

### 单独调用并拟写回复

当前对话已有明确的待回复对象和内容时，可只发送：

```text
$coach
```

教练会根据当前可见的聊天记录、背景及第三方 Skill 已给出的分析重新拟写一条消息。第三方建议中的句子不会自动成为改写目标，也不会自动触发技巧选择。狗头军师等第三方保存的档案，只有相关内容已出现在当前对话时才能供教练使用。若待回复对象、内容或必要材料不明确，教练会说明缺口。

### 主动开场

主动开场无需对方先发消息，但须明确提出，并让当前材料足以确定交流对象和意图。例如：

```text
$coach 我想主动联系小林，聊聊上次一起逛的旧书店。请帮我写一条开场消息。
```

如果当前对话只有主动联系的背景、没有待回复内容，单独发送 `$coach` 不会自动拟写开场；教练会请用户明确是否要开场。

### 了解技巧

```text
$coach 目前收录了哪些关系推进技巧？只列名称。
```

```text
$coach 介绍一下已收录的技巧分别适合什么情况。
```

### 根据场景推荐

```text
$coach 我和小林刚认识，正在玩线上桌游。她想要的卡被我先拿到了，刚笑着说“你真讨厌哈哈”。请从已收录技巧中选一个，帮我回一句。
```

用户明确要拟写回应或主动开场等可发送消息，或按上面的方式单独调用且待回复内容明确时，教练根据当前材料给出一条消息；要求推荐技巧时才筛选已收录条目，没有适用技巧仍可拟写普通消息。点名技巧时只按该条目核对，不强用不适用的技巧。只问技巧时给出用法，不写消息。教练只按已收录条目推荐，不凭记忆补写未收录技巧。出稿时读取[通用语言模式](skills/coach/references/expression.md)的通用层及按话轮匹配的开场层或接话层，逐条检查已读取层的全部反模式；所用技巧有专属语言模式时按条目原有条件和写法一并检查。技巧说明不套用聊天口吻。

拟写或改写可发送消息时，教练在同一轮中逐条检查已读取层的全部反模式，以及所用技巧的专属语言模式；没有出现禁止表现即通过对应反模式，不要求体现某种正向写法。若候选消息有明确违反，会依次展示候选版本、违反的模式和具体问题，再展示修订版本；没有固定修订次数。通过后以“最终可发送消息：”标出唯一可发送的版本；首版通过时只显示通过结果和最终消息。规则冲突或反复修订无进展时，不放行可发送消息。仅说明技巧或无法出稿时不显示自检记录。自检仍由同一模型完成，不保证不会漏判。

### 使用指定技巧

```text
$coach 请按“技巧名称”给出这次接话的使用要求。我忘了具体做法，先查已收录条目，不要写消息。
```

未收录的技巧需要先提供材料并明确要求收录，教练不会凭同名印象补写用法。

## 改写可发送消息

通过 `$coach` 提供要改写的消息，或明确指向当前对话中唯一的一条消息，并说明要怎样改写。消息可来自教练、用户或第三方；不要求使用已收录技巧。只有用户点名技巧时，教练才核对该条目。

```text
$coach 把这句换个角度，保持轻松的互动：好，看来咱俩要从这张卡开始当宿敌了。
```

```text
$coach 把上一条回答中的可发送消息换个说法，保留原场景和交流目标。
```

每次调用都要贴出原消息，或明确指向当前对话中唯一的一条消息；单说“换角度”不会触发自动选取。连续改写时仍须指明目标，并保留原场景、交流目标、已知事实和明确边界。完整规则见[教练 Skill](skills/coach/SKILL.md)。

## 拟写后改写

需要使用技巧时，让 `$coach` 直接拟写初稿。之后可继续用 `$coach` 改写该消息；第三方给出的初稿也可直接交给教练改写。第三方 Skill 的规则和记忆由它自行管理。

```text
$coach 请根据下面的聊天，从已收录技巧中选一个，帮我写一条回复。
聊天记录：
小林：这张卡我等半天了
我：好巧，被我拿到了
小林：你真讨厌哈哈
```

之后另发一条请求，例如：

```text
$coach 把教练上一条给出的可发送消息换个角度，保留轻松调侃的交流目标。
```

### 可用技巧

- [行为聊法](skills/coach/references/techniques/行为聊法.md)
- [状态感受切换法](skills/coach/references/techniques/状态感受切换法.md)
- [扩大冲突](skills/coach/references/techniques/扩大冲突.md)
- [魔趣法则](skills/coach/references/techniques/魔趣法则.md)

教练 Skill 可独立安装。用户级 Skill 放在 `~/.agents/skills/`，参见 [Codex 官方 Skill 说明](https://learn.chatgpt.com/docs/build-skills)。从仓库 `skills/coach/` 复制全部受版本控制文件到同名安装目录，保留 `SKILL.md`、`agents/openai.yaml` 和 `references/`。安装后通过 `$coach` 调用；新安装的 Skill 未显示时重启 Codex。曾单独复制安装拟人 Skill 的用户需自行移除旧安装目录，再使用教练的改写能力。

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

仅在用户明确要求时收录、修正或删除技巧。每项技巧保存在教练 Skill 的 `references/techniques/` 下，包含具体做法；首次收录时再创建该目录。修改技巧清单时同步更新上方“可用技巧”列表。正常使用不扫描 `docs/` 中保留的 EPUB。完整规则见[技巧库规则](skills/coach/references/library.md#收录与修正)。
