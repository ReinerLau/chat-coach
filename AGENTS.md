# chat-coach

## 项目范围

本仓库维护中文回复教练 Skill、联系人记录 Skill 和微信历史 MCP。

- 中文回复教练 Skill 规则：`skills/chat-reply/SKILL.md`；细节见同目录的 `references/`。
- 联系人记录 Skill 规则：`skills/contact-notes/SKILL.md`；档案维护细节见同目录的 `references/contact-notes.md`。开发者规则索引与两份 Skill 的一致性约定见 `docs/contact-notes.md`。
- 联系人档案保存于用户目录 `~/.chat-coach/contacts/`；Skill 内的 `contacts` 软链仅供本机查看，链接与个人数据不提交。
- 微信历史 MCP：`mcp-server/`。修改服务、管理页、打包或隧道运行逻辑前先读 `mcp-server/README.md`。
- 微信历史 MCP 只读本机微信历史，不调用模型、不发送消息。

## 开发约定

- 讨论或修改领域概念前读取 [CONTEXT.md](CONTEXT.md)，使用其中定义的术语。

- 每个分支只做一个需求或 Bug；通过分支和 PR 集成，不直接提交到 `master`。
- 两个 Skill 须可独立安装，运行规则与引用保留在各自目录内；调整联系人档案规则时，按 `docs/contact-notes.md` 核对两边兼容性。
- 需求有实质歧义时先用选项澄清，再实现。
- MCP 改动前运行现有 MCP 测试；改动后运行：
  `npm test --prefix mcp-server` 和 `npm run test:package --prefix mcp-server`。
- 修改两个 Skill 或联系人档案规则后，由用户手工测试；不要求运行自动化回复评测或输出评测报告。
- 只改文档或配置时，按影响范围做链接、引用和工作流检查。

## PR 与发布

- PR 目标为 `master`；GitHub Actions 运行 MCP 测试和独立包验证。
- PR 合并后，Auto Tag 工作流按 `major`、`minor`、`patch` label 更新 MCP 包版本并创建对应 Git tag；默认按 patch 递增。
- npm 包仍由维护者手动运行 **Publish WeChat MCP** 工作流发布。
- PR 创建后，用户按 `mcp-server/README.md` 验证本机微信同步、管理页和 MCP 查询路径；通过后再合并。
- 合并后按用户要求同步主线并清理已合并的本地分支。

## 风格

默认使用中文，简洁直接；除非用户先使用表情，否则不使用 emoji。
