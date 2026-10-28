# chat-coach

chat-coach 包含两个可独立使用的组件：

- **教练 Skill** 以狗头军师的流程梳理恋爱情绪、分析聊天与关系并给出行动建议；也可拟写或改写可发送消息，按需使用已收录的关系推进技巧，并在用户同意后维护本机可撤销的精简档案。
- **微信历史 MCP** 只读查询本机微信历史。

## 使用教练 Skill

通过 `$coach` 显式调用。一般关系咨询会先了解用户、对象和关键经过，再区分事实与推测，评估互惠、边界和现实可行性，给出下一步建议。明确要回复消息时先完成回复，再补必要的建档问题。跨任务保存精简关系档案须先取得用户明确同意；用户要求分析微信历史时，教练可使用已连接的 `@wechat` 微信历史插件查找并读取会话。插件不可用时仍可分析用户提供的文字或截图。

教练可根据关系反馈建议主动联系、邀约、修复或退出。已收录技巧只在用户明确要求推荐或使用时选择，所用技巧的具体写法与步骤放在同一文档中。拟写或改写消息会在用户同意且记忆未暂停时读取本机保存的话术偏好；本次明确要求优先，不自动改变长期偏好。没有保存偏好时，结合场景和用户口吻自然拟写。拟写消息可创作轻量的第一人称日常小事、状态和浅层感受，但不能编造对方行为、共同经历、双方约定、现实承诺或重大个人背景；用户询问时会如实说明创作部分。

### 单独调用并拟写回复

当前对话已有明确的待回复对象和内容时，可只发送：

```text
$coach
```

教练会结合当前可见的聊天记录、背景和已同意召回的档案拟写一条消息。其他来源建议中的句子不会自动成为改写目标，也不会自动触发技巧选择。若待回复对象、内容或必要材料不明确，教练会说明缺口。

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

用户明确要拟写回应或主动开场等可发送消息，或按上面的方式单独调用且待回复内容明确时，教练根据当前材料给出一条消息；要求推荐技巧时才筛选已收录条目，没有适用技巧仍可拟写普通消息。点名技巧时只按该条目核对，不强用不适用的技巧。只问技巧时给出用法，不写消息。教练只按已收录条目推荐，不凭记忆补写未收录技巧；使用技巧时按条目条件和专属写法处理。

能够出稿时，回复只展示一条可发送消息，以及场景需要的发送时机、代价或后续建议。已保存的话术偏好可用本机记忆脚本的 `show --subject-id user` 查看；暂停记忆后不再读取。只有用户明确要求修改偏好时才更新档案。

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

需要使用技巧时，让 `$coach` 直接拟写初稿。之后可继续用 `$coach` 改写该消息；其他 Skill 给出的初稿也可直接交给教练改写。各 Skill 的规则和记忆由各自管理。

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

- [行为聊法](skills/coach/references/practical/行为聊法.md)
- [状态感受切换法](skills/coach/references/practical/状态感受切换法.md)
- [扩大冲突](skills/coach/references/practical/扩大冲突.md)
- [魔趣法则](skills/coach/references/practical/魔趣法则.md)

教练 Skill 可独立安装。用户级 Skill 放在 `~/.agents/skills/`，参见 [Codex 官方 Skill 说明](https://learn.chatgpt.com/docs/build-skills)。从仓库 `skills/coach/` 复制全部受版本控制文件到同名安装目录，保留 `SKILL.md`、`agents/`、`references/`、`scripts/` 和 [LICENSE](skills/coach/LICENSE)。安装后通过 `$coach` 调用；新安装的 Skill 未显示时重启 Codex。曾单独安装 `$goutoujunshi` 的用户，更新本机安装时移除旧的 `goutoujunshi/` Skill 目录，避免出现两个入口；本机记忆数据仍在原位置。

更新 Skill 时，先保留自己后续收录的技巧，再用新版目录替换，避免旧规则文件残留。

## 查询微信历史

教练 Skill 按[微信历史插件适配](skills/coach/references/practical/微信历史插件适配.md)使用已连接的 `@wechat` 插件：先查找会话，重名时由用户确认，再按需分页读取。它不会发送微信消息。Skill 的独立安装包不包含插件；未连接时可分析用户提供的材料。

仓库内的[微信历史 MCP](mcp-server/README.md)仍供其他 MCP 客户端只读查询本机微信历史，不调用模型，也不发送微信消息。

安装、启动和 ChatGPT 接入步骤见 [MCP 使用说明](mcp-server/README.md)。

## 开发与发布

### 推送主分支与运行 CI

`master` 允许直接提交和推送，也可以通过分支和 PR 集成。推送到 `master` 或向 `master` 提交 PR 时，[CI 工作流](.github/workflows/ci.yml)会运行 MCP 测试、独立包验证和教练 Skill 校验。

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

仅在用户明确要求时收录、修正或删除技巧。每项技巧保存在教练 Skill 的 `references/practical/` 下，以技巧名称命名并包含具体做法；修改技巧清单时同步更新上方“可用技巧”列表与 [Skill 入口](skills/coach/SKILL.md)中的技巧链接。正常使用不扫描 `docs/` 中保留的 EPUB。
