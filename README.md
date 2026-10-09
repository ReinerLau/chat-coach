# chat-coach

chat-coach 包含中文回复教练 Skill、联系人记录 Skill 和微信历史 MCP。联系人记录 Skill 保存背景及线上、线下互动；中文回复教练 Skill 读取相关材料，根据用户意图生成自然、有活人感的候选回复。项目术语见 [CONTEXT.md](CONTEXT.md)。

## 中文回复教练 Skill

[中文回复教练 Skill](skills/chat-reply/SKILL.md) 按“确认意图 → 补齐事实 → 生成回复”处理聊天，联系人明确时读取已存档案；没有档案时继续使用已有材料。它只读取档案，详细规则见 Skill 正文。

仅通过 `$chat-reply` 手动调用，调用策略见 [agents/openai.yaml](skills/chat-reply/agents/openai.yaml)。

修改中文回复教练 Skill 后由用户手工测试。[手工测试集](docs/chat-reply-manual-tests.md) 提供 24 个原创虚构场景、1 个用户意图缺失的回归案例和空白记录区，供用户观察模型表现。测试数据放在 Skill 外，运行时不引用；后续可将实际遇到的问题追加为回归案例，再据此优化。

## 联系人记录 Skill

[联系人记录 Skill](skills/contact-notes/SKILL.md) 仅通过 `$contact-notes` 显式调用，支持查看、创建、补充、修正和删除联系人档案。独立记录背景无需说明本轮回复意图；明确的修改请求直接执行，身份或内容不清时先澄清。只调用 Skill 名而未说明操作时，会询问要查看或记录什么。

```text
$contact-notes 记一下小林的背景：我们是朋友介绍认识的，她在杭州工作。
$contact-notes 补充小林的互动：昨天线下吃饭，她说这两周准备考试，考完再约。
$contact-notes 修正小林的城市：之前记错了，她在上海。
$contact-notes 删除小林档案中关于城市的信息。
$contact-notes 查看小林的档案。
```

需要同轮保存背景并生成回复时，显式调用两个 Skill，先记录再回复：

```text
$contact-notes $chat-reply 记一下：小林今天说考试结束了。她刚发来“终于考完了”，我想祝贺她，顺便问问周末要不要吃饭，帮我回复。
```

### 数据与侧边栏

每个联系人一个 Markdown 文件，实际存放在当前用户目录 `~/.chat-coach/contacts/`。背景、当前情况、互动记录和个人观察分开保存，格式与查找规则统一见[联系人档案共用规则](docs/contact-notes.md)。微信历史按需查询，不复制全文到档案。当前版本只面向本机 Codex，ChatGPT 无法直接读取这些本机文件。

项目的 `.agents/skills/chat-reply` 和 `.agents/skills/contact-notes` 是指向源码的相对软链。两个 Skill 内的 `contacts` 软链指向同一个用户数据目录，可在文件侧边栏展开查看和编辑。发现链接随仓库提交，联系人目录链接及数据由 `.gitignore` 排除。

新机器上，在仓库根目录执行以下命令配置本机联系人目录链接。它会先检查已有路径；路径冲突时退出并报告，已有链接和文件不会被覆盖。

```sh
python3 - <<'PY'
from pathlib import Path

root = Path.cwd()
target = Path.home() / '.chat-coach/contacts'
links = [root / 'skills' / name / 'contacts'
         for name in ('chat-reply', 'contact-notes')]
for link in links:
    if not (link.parent / 'SKILL.md').is_file():
        raise SystemExit('请在包含两个 Skill 的仓库根目录运行')
    if link.is_symlink() and link.resolve() == target.resolve():
        continue
    if link.exists() or link.is_symlink():
        raise SystemExit(f'路径冲突，请先核对：{link}')
target.mkdir(parents=True, exist_ok=True)
for link in links:
    if not link.is_symlink():
        link.symlink_to(target, target_is_directory=True)
PY
```

两个 Skill 都引用仓库内的共用规则，使用时保留仓库目录结构。Skill 更新保留用户目录中的联系人档案。

## 微信历史 MCP

[`mcp-server/`](mcp-server/README.md) 同步本机微信消息，并通过只读工具供 MCP 客户端查找会话、分页读取历史。它不调用模型，也不发送微信消息。安装、隧道配置和运行说明见 [MCP 文档](mcp-server/README.md)。

## 仓库结构

```text
chat-coach/
├── .agents/skills/
│   ├── chat-reply -> ../../skills/chat-reply
│   └── contact-notes -> ../../skills/contact-notes
├── CONTEXT.md
├── docs/
│   ├── chat-reply-manual-tests.md
│   └── contact-notes.md
├── mcp-server/
└── skills/
    ├── chat-reply/
    │   ├── SKILL.md
    │   ├── agents/openai.yaml
    │   ├── contacts -> ~/.chat-coach/contacts（仅本机）
    │   └── references/materials.md
    └── contact-notes/
        ├── SKILL.md
        ├── agents/openai.yaml
        └── contacts -> ~/.chat-coach/contacts（仅本机）
```

| 位置 | 干什么的 |
| --- | --- |
| [CONTEXT.md](CONTEXT.md) | 项目领域术语及同义称呼的取舍。 |
| [docs/chat-reply-manual-tests.md](docs/chat-reply-manual-tests.md) | 可复制的聊天场景与手工测试记录区。 |
| [mcp-server/](mcp-server/README.md) | 微信历史 MCP 的实现、安装、配置与验证说明。 |
| [skills/chat-reply/SKILL.md](skills/chat-reply/SKILL.md) | 中文回复教练 Skill 入口，定义任务目标与上下文使用方式。 |
| [skills/chat-reply/agents/openai.yaml](skills/chat-reply/agents/openai.yaml) | 仅允许手动调用的策略配置。 |
| [skills/chat-reply/references/materials.md](skills/chat-reply/references/materials.md) | 微信历史 MCP 的查询用法。 |
| [skills/contact-notes/SKILL.md](skills/contact-notes/SKILL.md) | 联系人档案的查看与维护流程。 |
| [skills/contact-notes/agents/openai.yaml](skills/contact-notes/agents/openai.yaml) | 联系人记录 Skill 仅允许显式调用。 |
| [docs/contact-notes.md](docs/contact-notes.md) | 两个 Skill 共用的存储、格式与身份查找规则。 |

## 开发与验证

```sh
npm ci --prefix mcp-server
npm test --prefix mcp-server
npm run test:package --prefix mcp-server
```

修改两个 Skill 或联系人档案共用规则后，由用户手工测试，不运行自动回复评测或生成评测报告。仅改 Skill、文档或配置时，检查 frontmatter、调用策略、引用链接、软链和 Git 忽略规则；MCP 测试与独立包验证由现有 CI 运行。

### 联系人功能手工验收

使用虚构联系人，在新聊天中观察以下行为；用完后通过 `$contact-notes` 明确删除测试档案。

| 场景 | 预期 |
| --- | --- |
| 显式调用 `$contact-notes` 创建联系人，再追加一次线下互动。 | 创建一个档案，第二次更新同一文件，保留事件日期、渠道、来源及约定；两个侧边栏入口看到同一文件。 |
| 修正背景，再说明对方考试已经结束。 | 修正指定内容、更新当前情况，保留此前事件及仍待落实的约定。 |
| 删除城市信息、查看档案，再明确删除整个档案。 | 分别只删除指定信息、只读查看、删除整个文件。 |
| 只输入 `$contact-notes`，或提供无法确定身份的同名联系人。 | 询问操作或身份，澄清前不写入；已有唯一身份不重复询问。 |
| 在新聊天中用 `$chat-reply` 回复已记录的联系人，并明确本轮用户意图。 | 读取已存背景、生成候选回复；档案内容不变。 |
| 用 `$chat-reply` 回复没有档案的联系人。 | 使用已有材料，不自动创建档案。 |
| 有档案但未说明本轮用户意图，或档案包含历史意愿和个人观察。 | 仍确认用户意图；历史意愿不自动成为本轮承诺，个人观察不当作确定事实。 |
| 同轮显式调用两个 Skill，要求记录并生成回复。 | 先完成记录，再按本轮用户意图生成候选回复。 |

提交前确认暂存区只包含 Skill、文档、配置和相对发现软链，不包含联系人档案或绝对路径软链。
