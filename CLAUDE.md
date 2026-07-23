# chat-coach

You are a chat reply coach. Your job: help the user reply to messages naturally.

## How you work

聊天记录存储在飞书 Bitable 中。

用户在飞书 1v1 私聊中模拟对方发消息，Bot 自动返回回复建议。

启动方式：`python -m chat_coach.bot`

## 开发流程

1. **分支开发**：新需求或 Bug 修复必须从 `master` 新建分支，禁止直接在 `master` 上提交。`master` 是保护分支，保证当前版本稳定运行。
   - 每个分支只做一件事：一个需求或一个 Bug 修复，不要把不相干的改动堆在同一个分支里。
   - 动手前先判断：当前改动和当前分支的主题是否一致？如果不一致，另起新分支。
   - **AI 行为**：收到开发任务时，主动判断是否与当前分支主题匹配。如果不匹配，先提醒用户切到新分支再开始。
   - **Worktree 隔离**：新分支使用 `claude --worktree` 启动，自动创建独立 git worktree 目录，不同分支互不干扰，不用来回 stash 切分支。

2. **需求描述**：用户用自然语言描述需求或 Bug，不用写详细的 spec。AI 需要主动追问澄清模糊点，确保理解一致后再动手。

3. **Agent 开发**：AI 完成代码编写和自测，确保能跑通。完成后主动总结改动内容。

4. **自动化测试**：
   - **先跑现有测试**：改代码前先 `pytest tests/ -v`，确保现有功能没被破坏（回归测试）。
   - **必须补新测试**：每次改动如果涉及可测试的逻辑（新增函数、修 Bug、改行为），必须同步补测试。纯配置/文档类改动可跳过。
   - **改完再跑一次**：提交前再跑一次全量测试，确保全部通过。
   - **AI 行为**：开发完成后主动用子 Agent 跑测试，主上下文只看结果摘要，不要把跑测试这件事丢给用户。如果测试失败，修复后再提交。

5. **文档整理**：测试通过后，运行 `/neat-freak` 整理项目文档和规则文件，清理残留，确保 CLAUDE.md 和代码实际行为一致。

6. **提交 PR 并等 CI**：推送分支到远端，创建 PR 到 `master`。CI 自动跑 `pytest tests/ -v`。
   - **AI 行为**：PR 创建后，AI 用 `gh run watch` 阻塞等待 CI（单次 Bash 调用，不浪费 token 反复轮询）。CI 挂了则用 `gh run view --log` 拉失败详情，自动修复后推送再 `gh run watch`，最多修复 3 次。CI 通过后主动提醒用户进入第 7 步用户自测。

7. **用户自测**：CI 通过后，用户在本地启动 Bot 做实机验证：
   1. `python -m chat_coach.bot` 启动服务
   2. 在飞书 1v1 私聊中给 Bot 发消息，模拟真实对话场景
   3. 确认 Bot 回复符合预期，无报错
   4. 验证通过后进入第 8 步合并 PR

8. **合并 PR**：用户自测通过且 review 确认无误后，在 GitHub 上点击 "Squash and merge"，将 PR 合并到 `master`。
   - 合并后 GitHub Actions 自动：删远端分支 → 根据 PR label 计算版本号 → 打 tag → 推远端
   - PR 需打上 `major`、`minor` 或 `patch` label 来指定版本升级类型（默认 `patch`）

9. **回归主线**：PR 合并后，用户通知 AI，AI 自动执行：
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
