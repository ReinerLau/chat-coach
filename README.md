# chat-coach

chat-coach 包含中文回复教练 Skill、联系人记录 Skill 和微信历史 MCP。中文回复教练 Skill 默认帮助用户与女性建立及维系恋爱关系，根据真实聊天、关系和时机提供接话方向及示例回复，并联动联系人记录 Skill 保存有参考价值的背景与互动。用户自行选择、修改并发送实际回复。项目术语见 [CONTEXT.md](CONTEXT.md)。

## 中文回复教练 Skill

[中文回复教练 Skill](skills/chat-reply/SKILL.md) 按“理解场景 → 判断交流三层次 → 按需读取原则与技巧 → 给出方向及示例”处理聊天，覆盖初识、约会和确定关系后。性别未说明时按默认用途理解，但不把性别、好感或关系状态当成已确认事实；明确的非恋爱目的、其他对象和用户当前意愿优先，单称“朋友”不排除关系发展。联系人明确时读取已存档案。两个 Skill 都已安装时，每次取得新材料后自动联动联系人记录 Skill，保存有后续参考价值的信息；身份明确且有可保存信息时可自动建档。联动细节见[自动记录说明](skills/chat-reply/references/auto-notes.md)。

自动记录覆盖用户说明、贴出的聊天和本轮按需查到的微信历史，核对已有档案后保存增量。成功时默认静默；身份不明或信息冲突无法解释时先澄清，缺少联系人记录 Skill 或保存失败时简短说明并继续接话。示例回复和模型推测不入档，用户的打算不记成已发生的互动；明确要求不记录时按指定范围跳过保存。

每次新的接话建议请求都按[接话方向引导](skills/chat-reply/references/intent-guidance.md)展示固定三行“态度、情绪、想法”，只写有依据的交流线索；没有依据的层次写“暂无依据”。按[原则索引](skills/chat-reply/references/principles/index.md)读取交流层次、共情、赞美、邀约及平衡表达等规则，并按[技巧索引](skills/chat-reply/references/techniques/index.md)选用行为聊法、扩大冲突或魔趣法则。接梗属于接话方向，只有实际使用扩大冲突时才标为技巧。行为聊法不限寒暄：对方内容能自然连接到用户做过、正在做或有机会想做的事时，可用具体行为回应，而不只作笼统评价。之后先盘点不同接话点和交流作用，筛掉重复或不合适的方向，直接给出所有适合且有实质差异的方向，不预设数量；每个方向逐条标注方向、技巧和原则；可发送方向附示例回复，不先确认或等待用户选择。用户提出的接法作为场景材料，Skill 仍根据真实对话判断；可能冒犯、答非所问或越过边界时说明依据并给合适替代。关系推进以时机为准，可以轻接、收住或暂不回复。仅询问回复效果时直接分析。

三行判断依据来自[交流层次判断原则](skills/chat-reply/references/principles/conversation-levels.md)。态度一行看当下交流空间，情绪一行看对方明确表达的感受，想法一行看问题、观点或选择。书中态度六级只作参考，不强求定级，也不把当前消息表现当成固定关系或对方心理。

示例可使用用户明确提供且时间准确的经历、感受或立场；行为聊法还可在不与已知偏好冲突时表达「有机会也想试试」这类非承诺性兴趣，不把它写成已发生的行为或确定计划。没有足够材料时，优先给不依赖其个人事实的方向。只有缺少待回复内容等关键材料、无法据实提供方向时才先询问。用户补充新聊天或要求换方向时，按最新材料直接调整，不循环确认。

仅通过 `$chat-reply` 手动调用，调用策略见 [agents/openai.yaml](skills/chat-reply/agents/openai.yaml)。

修改中文回复教练 Skill 后由用户手工测试。[手工测试集](docs/chat-reply-manual-tests.md) 使用女性一对一恋爱发展场景：01–24 观察三层判断与方向示例，25–69 覆盖材料、自动记录、连续反馈、交流边界、邀约与共情等情况，70–75 检查接梗及其边界，76–81 检查魔趣法则，82–87 检查平衡表达，88–95 检查行为聊法及其边界，96–98 检查方向覆盖、边界与普通回应。测试时可能自动创建或更新档案，请使用可辨认的虚构联系人，按测试说明清理。测试数据放在 Skill 外，运行时不引用。

## 联系人记录 Skill

[联系人记录 Skill](skills/contact-notes/SKILL.md) 可通过 `$contact-notes` 显式查看或维护档案，也可由正在进行的中文回复教练 Skill 回复流程自动联动。普通聊天中仅提供联系人背景或互动，不自动记录。独立记录背景无需说明本轮回复意图；明确的修改请求直接执行，身份或内容不清时先澄清。只调用 Skill 名而未说明操作时，会询问要查看或记录什么。

```text
$contact-notes 记一下小林的背景：我们是朋友介绍认识的，她在杭州工作。
$contact-notes 补充小林的互动：昨天线下吃饭，她说这两周准备考试，考完再约。
$contact-notes 修正小林的城市：之前记错了，她在上海。
$contact-notes 删除小林档案中关于城市的信息。
$contact-notes 查看小林的档案。
```

日常接话建议只需调用 `$chat-reply`，以下材料中的考试结束会自动保存，方向中的邀约示例不会被记成已发送消息：

```text
$chat-reply 小林今天刚发来“终于考完了”，我想祝贺她，顺便问问周末要不要吃饭，帮我回复。
```

仍可同轮显式调用两个 Skill，先执行指定的记录、修正或删除操作，再回复；自动联动只补充未保存且未被排除的信息，避免重复记录。删除的信息不从同轮材料补回，删除整个档案后本轮不自动重建。

## Skill 安装

两个 Skill 均可独立安装，运行所需规则随各自目录提供。按照 [Codex 官方 Skill 说明](https://learn.chatgpt.com/docs/build-skills)，用户级 Skill 放在 `~/.agents/skills/`：

1. 从仓库的 `skills/` 中选择 `chat-reply`、`contact-notes` 或两者，将所选目录内的全部受版本控制文件复制到 `~/.agents/skills/` 下的同名目录。
2. 保留 `SKILL.md`、`references/` 和 `agents/openai.yaml`，不能只复制入口文件。安装目录中无需放置仓库的 `docs/`、另一个 Skill 或本机 `contacts` 软链。
3. 在 Codex 中通过 `$chat-reply` 开始回复流程，联系人记录 Skill 在流程内自动联动；独立维护档案时通过 `$contact-notes` 显式调用。未显示新安装的 Skill 时，重启 Codex。

只安装中文回复教练 Skill 也可读取已有联系人档案；没有档案时继续使用当前聊天材料，首次需要保存时提示安装联系人记录 Skill，中文回复教练 Skill 不自行写入档案。希望自动记录时安装两个 Skill；只安装联系人记录 Skill 仍可独立维护档案。微信历史查询另需配置[微信历史 MCP](mcp-server/README.md)，读取和保存联系人档案本身不要求连接它。

中文回复教练 Skill 的调用策略保持 `allow_implicit_invocation: false`；联系人记录 Skill 改为 `true`，并通过描述和流程规则限定为显式调用或回复流程内联动。配置没有按调用方限制的开关，实际触发范围由用户手工验证。

更新时替换所选 Skill 的规则文件，保留用户目录中的联系人档案；现有档案无需迁移。在本仓库内开发时，也可直接使用已有的 `.agents/skills/` 发现链接。

### 数据与侧边栏

每个联系人一个 Markdown 文件，实际存放在当前用户目录 `~/.chat-coach/contacts/`。背景、当前情况、互动记录和个人观察分开保存；读取方式见[材料读取说明](skills/chat-reply/references/materials.md)，完整格式与维护规则见[联系人档案维护规则](skills/contact-notes/references/contact-notes.md)。微信历史按需查询，不复制全文到档案。当前版本只面向本机 Codex，ChatGPT 无法直接读取这些本机文件。

项目的 `.agents/skills/chat-reply` 和 `.agents/skills/contact-notes` 是指向源码的相对软链。两个 Skill 内可选的 `contacts` 软链指向同一个用户数据目录，仅供在文件侧边栏展开查看和编辑；运行时直接访问用户数据目录，不依赖这些软链。发现链接随仓库提交，联系人目录链接及数据由 `.gitignore` 排除。

需要在仓库侧边栏查看联系人档案时，可在仓库根目录执行以下命令配置本机联系人目录链接；独立安装 Skill 无需运行。它会先检查已有路径；路径冲突时退出并报告，已有链接和文件不会被覆盖。

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

两个 Skill 的规则组织与一致性维护说明见[联系人档案规则索引](docs/contact-notes.md)，该索引仅供开发者使用。

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
    │   ├── contacts -> ~/.chat-coach/contacts（仅本机，可选）
    │   └── references/
    │       ├── auto-notes.md
    │       ├── intent-guidance.md
    │       ├── materials.md
    │       ├── principles/（原则索引与按需读取的原则）
    │       └── techniques/（技巧索引与按需读取的技巧）
    └── contact-notes/
        ├── SKILL.md
        ├── agents/openai.yaml
        ├── contacts -> ~/.chat-coach/contacts（仅本机，可选）
        └── references/contact-notes.md
```

| 位置 | 干什么的 |
| --- | --- |
| [CONTEXT.md](CONTEXT.md) | 项目领域术语及同义称呼的取舍。 |
| [docs/chat-reply-manual-tests.md](docs/chat-reply-manual-tests.md) | 可复制的聊天场景、交流三层次判断、方向示例与自动记录验收步骤。 |
| [mcp-server/](mcp-server/README.md) | 微信历史 MCP 的实现、安装、配置与验证说明。 |
| [skills/chat-reply/SKILL.md](skills/chat-reply/SKILL.md) | 中文回复教练 Skill 入口，定义任务目标与上下文使用方式。 |
| [skills/chat-reply/agents/openai.yaml](skills/chat-reply/agents/openai.yaml) | 仅允许手动调用的策略配置。 |
| [skills/chat-reply/references/auto-notes.md](skills/chat-reply/references/auto-notes.md) | 回复流程内自动联动记录的时机、交接与异常处理。 |
| [skills/chat-reply/references/intent-guidance.md](skills/chat-reply/references/intent-guidance.md) | 交流三层次模板、接话方向与示例回复、连续反馈处理。 |
| [skills/chat-reply/references/materials.md](skills/chat-reply/references/materials.md) | 联系人档案的读取与使用边界，以及微信历史 MCP 的查询用法。 |
| [skills/chat-reply/references/principles/index.md](skills/chat-reply/references/principles/index.md) | 交流层次、共情、赞美、邀约、平衡表达等原则的按需读取条件。 |
| [skills/chat-reply/references/techniques/index.md](skills/chat-reply/references/techniques/index.md) | 行为聊法、扩大冲突、魔趣法则等技巧的按需读取条件。 |
| [skills/chat-reply/references/principles/conversation-levels.md](skills/chat-reply/references/principles/conversation-levels.md) | 态度、情绪、想法三层交流线索的判断原则。 |
| [skills/chat-reply/references/principles/balance.md](skills/chat-reply/references/principles/balance.md) | 在有依据的赞美或共同计划中，用真实限制或轻微自嘲调节语气。 |
| [skills/chat-reply/references/techniques/behavior-chat.md](skills/chat-reply/references/techniques/behavior-chat.md) | 将对方所说的具体内容连接到用户的行为或条件式兴趣，不限于寒暄。 |
| [skills/chat-reply/references/techniques/expand-conflict.md](skills/chat-reply/references/techniques/expand-conflict.md) | 在接梗方向中使用夸张反驳或角色互换；轻接玩笑不算该技巧。 |
| [skills/chat-reply/references/techniques/moqu.md](skills/chat-reply/references/techniques/moqu.md) | 已选方向中有联系感的夸张表达方式。 |
| [skills/contact-notes/SKILL.md](skills/contact-notes/SKILL.md) | 联系人档案的查看与维护流程。 |
| [skills/contact-notes/agents/openai.yaml](skills/contact-notes/agents/openai.yaml) | 允许自动调用，触发范围由入口描述和流程限定。 |
| [skills/contact-notes/references/contact-notes.md](skills/contact-notes/references/contact-notes.md) | 联系人档案的存储、身份查找、文件格式与维护规则。 |
| [docs/contact-notes.md](docs/contact-notes.md) | 开发者规则索引与两个 Skill 的一致性约定，运行时不引用。 |

## 开发与验证

```sh
npm ci --prefix mcp-server
npm test --prefix mcp-server
npm run test:package --prefix mcp-server
```

修改两个 Skill 或联系人档案规则后，由用户手工测试，不运行自动回复评测或生成评测报告。仅改 Skill、文档或配置时，检查 frontmatter、调用策略、引用链接、软链和 Git 忽略规则；将两个 Skill 的受版本控制文件分别复制到隔离临时目录，确认运行规则链接均位于各自目录内且有效。涉及联系人档案格式或查找规则时，按[规则索引](docs/contact-notes.md)核对两边兼容性。MCP 测试与独立包验证由现有 CI 运行。

### 联系人功能手工验收

使用虚构联系人，在新聊天中观察以下行为；用完后通过 `$contact-notes` 明确删除测试档案。

| 场景 | 预期 |
| --- | --- |
| 在仓库外仅安装中文回复教练 Skill，用已有档案回复并提供新背景。 | 独立读取档案；首次需要保存时提示安装联系人记录 Skill，继续回复且不自行写入。 |
| 在仓库外仅安装联系人记录 Skill，创建、查看并删除一个虚构联系人档案。 | 独立完成操作，运行时只读取自身规则，不要求安装中文回复教练 Skill。 |
| 显式调用 `$contact-notes` 创建联系人，再追加一次线下互动。 | 创建一个档案，第二次更新同一文件，保留事件日期、渠道、来源及约定；若配置两个侧边栏入口，它们看到同一文件。 |
| 修正背景，再说明对方考试已经结束。 | 修正指定内容、更新当前情况，保留此前事件及仍待落实的约定。 |
| 删除城市信息、查看档案，再明确删除整个档案。 | 分别只删除指定信息、只读查看、删除整个文件。 |
| 只输入 `$contact-notes`，或提供无法确定身份的同名联系人。 | 询问操作或身份，澄清前不写入；已有唯一身份不重复询问。 |
| 在新聊天中只用 `$chat-reply` 回复已记录的联系人，并提供新背景。 | 自动保存增量后提供方向及示例；成功时静默，已有信息不重复追加。 |
| 只用 `$chat-reply` 回复身份明确、没有档案的联系人。 | 有可保存信息时自动建档，使用当前材料继续回复。 |
| 未指定接法，或连续交互中补充背景和实际互动。 | 在提供方向前及时保存新信息，无需重复调用两个 Skill。 |
| 本轮查到微信历史，再重复查询同一段历史。 | 保存有用摘要及来源和日期，不重复追加，不为记录额外查询；旧状态不覆盖较新的当前情况。 |
| 提供打算、讨论方向、调整示例回复，之后说明消息已经发送。 | 打算与实际互动区分，方向及示例回复不入档；确认已发送后才记录实际互动。 |
| 有档案但未说明想怎么接，或档案包含历史意愿和个人观察。 | 仍按当前对话提供方向；历史意愿不自动成为本轮承诺，个人观察不当作确定事实。 |
| 同轮显式调用两个 Skill，要求记录、修正或删除并生成回复。 | 先执行明确操作，再核对自动增量；不重复记录，不补回同轮删除的信息或重建已删除档案。 |
| 要求本轮或指定信息不记录；身份有歧义或信息冲突无法解释。 | 遵从记录限制；歧义先澄清，澄清前不猜测写入。 |
| 联系人记录 Skill 写入失败或保存结果无法核对。 | 简短说明失败并继续回复，不声称已保存。 |
| 新聊天中未调用任何 Skill，仅描述联系人背景或互动；或回复流程结束后转为其他任务。 | 不触发自动记录。 |

提交前确认暂存区只包含 Skill、文档、配置和相对发现软链，不包含联系人档案或绝对路径软链。
