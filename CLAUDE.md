# chat-coach

## 项目范围

本仓库只维护中文回复教练 Skill 和微信历史 MCP。

- 回复规则：`skills/chat-reply/SKILL.md`；细节和评测分别见同目录的 `references/` 与 `EVAL.md`。
- 微信历史 MCP：`mcp-server/`。修改服务、管理页、打包或隧道运行逻辑前先读 `mcp-server/README.md`。
- MCP 只读本机微信历史，不调用模型、不发送消息。

## 开发约定

- 每个分支只做一个需求或 Bug；通过分支和 PR 集成，不直接提交到 `master`。
- 需求有实质歧义时先用选项澄清，再实现。
- MCP 改动前运行现有 MCP 测试；改动后运行：
  `npm test --prefix mcp-server` 和 `npm run test:package --prefix mcp-server`。
- 修改 `skills/chat-reply/**` 时，按 `skills/chat-reply/EVAL.md` 使用 3 个相互隔离的 Agent 完成 Baseline、Skill、Judge 评测；未达门槛不得提交 PR。
- 只改文档或配置时，按影响范围做链接、引用和工作流检查。

## PR 与发布

- PR 目标为 `master`；GitHub Actions 运行 MCP 测试和独立包验证。
- PR 合并后，Auto Tag 工作流按 `major`、`minor`、`patch` label 更新 MCP 包版本并创建对应 Git tag；默认按 patch 递增。
- npm 包仍由维护者手动运行 **Publish WeChat MCP** 工作流发布。
- PR 创建后，用户按 `mcp-server/README.md` 验证本机微信同步、管理页和 MCP 查询路径；通过后再合并。
- 合并后按用户要求同步主线并清理已合并的本地分支。

## 风格

默认使用中文，简洁直接；除非用户先使用表情，否则不使用 emoji。
