# chat-coach

## 项目范围

本仓库维护中文回复教练 Skill、联系人记录 Skill、微信接话 Skill 和微信历史 MCP。

- 中文回复教练 Skill 规则：`skills/chat-reply/SKILL.md`；细节见同目录的 `references/`。
- 联系人记录 Skill 规则：`skills/contact-notes/SKILL.md`；档案维护细节见同目录的 `references/contact-notes.md`。开发者规则索引与两份 Skill 的一致性约定见 `docs/contact-notes.md`。
- 微信接话 Skill 规则：`skills/humanize/SKILL.md`；根据用户贴出的微信聊天接话，不读取微信历史或联动联系人记录。
- 联系人档案保存于用户目录 `~/.chat-coach/contacts/`；Skill 内的 `contacts` 软链仅供本机查看，链接与个人数据不提交。
- 微信历史 MCP：`mcp-server/`。修改服务、管理页、打包或隧道运行逻辑前先读 `mcp-server/README.md`。
- 微信历史 MCP 只读本机微信历史，不调用模型、不发送消息。

## 开发约定

- 讨论或修改领域概念前读取 [CONTEXT.md](CONTEXT.md)，使用其中定义的术语。
- 将 `docs/chat-reply-manual-tests.md` 限定为可直接复制发送的手工测试输入；测试输入之外的观察、测试流程、评测或迭代说明，仅在用户明确要求时加入。

- 允许直接提交并推送到 `master`，分支和 PR 为可选方式；使用分支时，每个分支只做一个需求或 Bug。
- 各 Skill 须可独立安装，运行规则与引用保留在各自目录内；调整联系人档案规则时，按 `docs/contact-notes.md` 核对中文回复教练与联系人记录 Skill 的兼容性。
- 新增、重命名或删除技巧时，同步更新根目录 `README.md` 的“可用技巧”清单，直接列出技巧名称及对应文档链接，与 Skill 内技巧文档保持一致；不在 README 中另写技巧定义。
- 需求有实质歧义时先用选项澄清，再实现。
- MCP 改动前运行现有 MCP 测试；改动后运行：
  `npm test --prefix mcp-server` 和 `npm run test:package --prefix mcp-server`。
- 修改中文回复教练 Skill、联系人记录 Skill 或联系人档案规则后，用户可按需手工测试；不要求运行自动化回复评测或输出评测报告，手工测试结果不作为合并前置条件。
- 只改文档或配置时，按影响范围做链接、引用和工作流检查。

## CI 与发布

- 推送到 `master` 或向 `master` 提交 PR 时，GitHub Actions 运行 MCP 测试和独立包验证；主分支不设置保护规则。
- 用户明确要求“合并”即视为授权合并当前 PR，不再二次确认。合并前检查 PR 检查结果；无需等待或索要手工测试确认。遇到 PR 检查失败、冲突或其他明确阻塞时，说明具体情况。
- MCP 包版本与对应 Git tag 由维护者手动管理；升版时同时更新 `mcp-server/package.json` 和 `mcp-server/package-lock.json`，提交后创建并推送对应 tag。
- npm 包仅由维护者手动运行 **Publish WeChat MCP** 工作流发布，工作流检查并发布 `master` 当前版本到 GitHub Packages。
- 微信历史 MCP 的服务、管理页、打包或隧道运行逻辑有改动时，用户按 `mcp-server/README.md` 验证本机同步、管理页和 MCP 查询路径；使用 PR 集成时，通过验证后再合并。
- 合并后按用户要求同步主线并清理已合并的本地分支。

## 风格

默认使用中文，简洁直接；除非用户先使用表情，否则不使用 emoji。
