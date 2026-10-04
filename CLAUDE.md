# chat-coach

## 项目目标

### 要解决的问题

1. **回复卡壳** — 对方发消息后不知道怎么回，需要灵感
2. **回复太生硬** — 自己的回复太正式/无趣，想要更自然的表达方式
3. **社交焦虑/过度思考** — 琢磨措辞太久，需要有人帮做决定
4. **缺乏回复思路** — 想学会怎么回复，脱离 Bot 后自己也能回

### 核心成功标准

**优先保下限，不追求出彩**。回复的第一目标是不被对方讨厌、不犯社交错误、保持克制。

- 自然不做作 — 对方看不出是机器生成的，但不需要刻意有趣或热情
- 不冒犯 — 不越界、不轻浮、不冷淡敷衍
- 不犯傻 — 不在不该调侃时调侃，不在需要认真时碎片化
- 克制 — 宁可偏保守，不要表演。回复是帮你过关，不是帮你加分

### Bot 定位：教练，不是代聊工具

除了帮用户回复，还要让用户学到东西：

- 每条回复附带简短思路（如"用自嘲化解尴尬"、"把话题抛回去"），让用户理解背后的策略
- 支持历史复盘 — 事后能回顾不同场景下的回复，对比学习

### 边界

- 不是 AI 代聊机器 — 目标是帮用户学习，不是替用户隐身
- 不是人格模拟器 — 用户自身风格尚未确定，后续版本可通过回顾选中记录帮用户发现偏好，当前不预设人设
- 不针对特定对象类型 — 不做暧昧对象/同事等针对性优化，只做通用回复教练

## How you work

当前有两条运行路径：

- 旧版飞书 Bot：聊天记录存储在飞书 Bitable；用户在飞书 1v1 私聊中模拟对方发消息。启动方式：`python3 -m chat_coach.bot`。
- DSH 微信插件：`dsh-plugin/` 独立读取本机微信数据库并持久化消息；手机经局域网访问 DSH，按需生成建议，建议不留记录。安装与启动见 `dsh-plugin/README.md`。

## 开发流程

**自检规则**：收到开发任务时，步骤 1 已由用户手动完成（用户用 `claude --worktree` 启动新 worktree）。AI 必须先用 `TaskCreate` 把步骤 2-11 全部创建为任务（当前步骤标 `in_progress`，其余标 `pending`），然后按序执行。每一步完成后立即标记 `completed`，再开始下一步。如果一个步骤被跳过，它会留在任务列表里——这就是自检信号。步骤 6（提交 PR）和步骤 11（回归主线）由 AI 自动执行，不询问用户。

### 自测不通过时的红线（违反即流程违规）

当第 8 步判断验证结果为不通过，AI **在动手改代码之前**必须先做两件事，顺序不可颠倒：

1. `TaskUpdate status: deleted` 清空步骤 3-11 的旧任务
2. `TaskCreate` 重新创建步骤 3-8（步骤 3 标 `in_progress`）和步骤 9-11（标 `pending`），步骤 1-2 不需要重建

做完这两步之后才能开始修代码。**收到自测反馈的第一反应不是改代码，是重置任务列表。**

1. **分支开发**（用户手动执行）：用户用 `claude --worktree` 启动新 worktree，自动从 `master` 新建分支。`master` 未在 GitHub 上开启分支保护（免费版私有仓库不支持），但按流程约定仍禁止直接提交，统一走分支 + PR。
   - 每个分支只做一件事：一个需求或一个 Bug 修复。
   - 动手前先判断：当前改动和当前分支的主题是否一致？如果不一致，另起新分支。
   - **Worktree 隔离**：worktree 自动创建独立 git 工作目录，不同分支互不干扰，不用来回 stash 切分支。
   - AI 收到任务时用户应已在 worktree 中，从步骤 2 开始介入。

2. **需求描述**：用户用自然语言描述需求或 Bug，不用写详细的 spec。AI 需要主动追问澄清模糊点，使用 `AskUserQuestion` 进行选项式问答，确保理解一致后再动手。

3. **Agent 开发**：AI 完成代码编写和自测，确保能跑通。完成后主动总结改动内容。

4. **自动化测试**：
   - **先跑现有测试**：改代码前先 `pytest tests/ -v`，确保现有功能没被破坏（回归测试）。
   - **必须补新测试**：每次改动如果涉及可测试的逻辑（新增函数、修 Bug、改行为），必须同步补测试。纯配置/文档类改动可跳过。
   - **改完再跑一次**：提交前再跑一次全量测试，确保全部通过。
   - **AI 行为**：开发完成后主动用子 Agent 跑测试，主上下文只看结果摘要，不要把跑测试这件事丢给用户。如果测试失败，修复后再提交。

5. **文档整理**：测试通过后，运行 `/neat-freak` 整理项目文档和规则文件，清理残留，确保 CLAUDE.md 和代码实际行为一致。

6. **提交 PR**：推送分支到远端，创建 PR 到 `master`。GitHub Actions 自动触发 `pytest tests/ -v`。
   - **AI 行为**：PR 创建后不等 CI，直接提醒用户进入第 7 步用户自测。CI 在后台跑，结果稍后在第 9 步处理。

7. **用户自测**：PR 创建后不等 CI，用户立即在本地验证本次改动涉及的运行路径：
   1. 飞书 Bot 改动：运行 `python3 -m chat_coach.bot`，在飞书 1v1 私聊中模拟对话。
   2. DSH 插件改动：按 `dsh-plugin/README.md` 启动 DSH，在手机浏览器打开插件页面，查看同步消息并按需生成一条建议。
   3. 确认行为符合预期且无报错，告知 AI “验证通过”或描述问题，进入第 8 步。

8. **判断验证结果**：AI 根据用户反馈判断：
   - **验证通过**（用户明确说"通过"/"OK"/"没问题"等）→ 进入第 9 步等 CI
   - **验证不通过**（报错、行为不符预期等）→ AI 回到步骤 3 修复问题，重新走 3→4→5→6→7→8 流程。修复前必须先执行红线规则：清空步骤 3-11 旧任务 → 重建步骤 3-8（步骤 3 标 `in_progress`）和步骤 9-11（标 `pending`）

9. **等 CI**：验证通过后，AI 处理 CI 结果：
   - CI 可能还在跑或已经结束，AI 用 `gh run list --branch` 找最新 run，再 `gh run watch <id> --exit-status` 阻塞等待完成（单次调用，不反复轮询）。
   - CI 通过：进入第 10 步合并 PR。
   - CI 失败：AI 用 `gh run view --log` 拉失败详情，自动修复后推送再等 CI，最多修复 3 次。CI 修复只涉及机械问题（lint、import、测试断言），不改业务行为，无需用户二次自测。CI 通过后进入第 10 步。

10. **合并 PR**：用户自测和 CI 均通过后，AI 提醒用户在 GitHub 上点击 "Squash and merge"，将 PR 合并到 `master`。
   - 合并后 GitHub Actions 自动：删远端分支 → 根据 PR label 计算版本号 → 打 tag → 推远端
   - PR 需打上 `major`、`minor` 或 `patch` label 来指定版本升级类型（默认 `patch`）

11. **回归主线**：PR 合并后，用户通知 AI，AI 自动执行：
   - `cd <项目主目录>` 回到主 worktree
   - `git pull` 拉最新 master（含刚合并的 PR 和 auto-tag）
   - `git fetch --prune` 清理远端已删除的分支引用
   - `git branch --merged master | grep -v master | xargs git branch -d` 清理本地已合并分支
   - 退出当前 worktree session，下一个需求从步骤 1 重新开始

**流程执行规则**：每一步完成后，AI 必须主动提醒用户下一步该做什么，不能等用户来问。

## Style

- Use Chinese by default
- Be terse and direct — you're a tool, not a companion
- No emojis unless the user uses them first

## Agent skills

### Issue tracker

Issues and specs for this repo live as markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles use the default label strings (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: one `CONTEXT.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
