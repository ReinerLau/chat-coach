# chat-coach

chat-coach 包含中文回复教练 Skill、联系人记录 Skill 和微信历史 MCP。中文回复教练 Skill 根据真实聊天提供示例回复。联系人记录 Skill 保存有后续参考价值的背景和互动。微信历史 MCP 只读查询本机微信历史。用户自行选择、修改并发送实际回复。

项目术语见 [CONTEXT.md](CONTEXT.md)。

## 使用 Skill

### 中文回复教练 Skill

[中文回复教练 Skill](skills/chat-reply/SKILL.md) 只通过 `$chat-reply` 手动调用。它适用于初识、约会和确定关系后。调用时将联系人名写在调用名后。

用 `--strategy <策略名>` 选择整套策略。也可用 `--intent <意图名>`、`--principle <原则名>` 和 `--technique <技巧名>` 自定义组合。原则和技巧参数可以重复使用。用 `--context "用户说明"` 提供本轮材料。

正式[意图](skills/chat-reply/references/intents/index.md)包括接话、共情、赞美、邀约和起头。[策略](skills/chat-reply/references/strategies/index.md)包括接话、起头、共情、轻松共情、赞美和邀约。专属原则和技巧位于对应意图目录。[公共原则和技巧](skills/chat-reply/references/shared/index.md)仅在意图清单允许时可用。

`--strategy` 不能与意图、原则或技巧参数混用。每轮最多选择一个意图；原则和技巧可分别选择多个不同项。只写意图时，使用对应策略。意图与单项同写时，仅使用显式组合。只写单项时，以默认的“接话”策略为基础。不做选择时，默认使用“接话”。

随 Skill 安装的[校验脚本](skills/chat-reply/scripts/selection.py)解析这些选择，并拒绝跨意图项目。例如，只写 `--technique 夸张引申` 会落到默认“接话”意图，因此无效。此时须明确选择共情意图或策略。旧 `--mode`、`--strategy 普通回应`，以及将技巧名写入 `--strategy`，均无效。

每条示例回复都须体现所有选定技巧。场景不适用时，说明具体原因并请用户改选，不擅自省略。原则仅在策略包含或用户点名时生效。含义明确的自然语言调用仍可使用。同一目标的改写沿用本轮选择；对方发来新消息后重新使用默认“接话”。仅分析现有回复效果时无需选择。“邀约”仅用于回应线下见面邀约后的顾虑。

性别未说明时，按默认用途理解，但不将性别、好感或关系状态当作已确认事实。明确的非恋爱目的、其他对象和用户当前意愿优先。单称“朋友”不排除关系发展。

接话但未提供待回复消息时，按[材料读取说明](skills/chat-reply/references/materials.md)查找对方最新消息，并结合其后用户已发的内容续写。末条由自己发送时，不自动要求澄清。起头以用户说明或近期真实互动切入。材料不足时，询问具体缺口。拟写前按[示例检查](skills/chat-reply/references/review.md)核对本轮选定项。

两个 Skill 都已安装时，中文回复教练 Skill 会在每次取得新材料后联动联系人记录 Skill。它按[自动记录说明](skills/chat-reply/references/auto-notes.md)保存有后续参考价值的信息。身份明确且有可保存信息时，可自动建档。

自动记录覆盖用户说明、贴出的聊天和本轮按需查到的微信历史。保存前须核对已有档案，仅记录增量。保存成功时默认不提示。身份不明或信息冲突无法解释时，先澄清。缺少联系人记录 Skill 或保存失败时，简短说明并继续回复。

示例回复、所选意图、原则、技巧、策略和模型推测不入档。用户的打算不记成已发生的互动。用户明确要求不记录时，按指定范围跳过保存。

Skill 的调用配置见 [agents/openai.yaml](skills/chat-reply/agents/openai.yaml)。可按需复制已有的[手工测试输入](docs/chat-reply-manual-tests.md)。Skill 运行时不引用该文件。

#### 规则出处

下表用于回查书中相关章节。书籍提供表达思路。原则和技巧文档中的事实依据、用户当前意愿及边界条件由项目制定，不作为书中原文。只有被选中的原则及技巧自身的适用条件在本轮生效。Skill 运行时只读取自身目录内的规则，不依赖本表或 EPUB。

| 意图或技巧 | 书籍 | 相关章节或小节 |
| --- | --- | --- |
| 共情 | [《魔鬼聊天术》](docs/魔鬼聊天术.epub) | 你一直在错误地“共情” |
| 赞美 | [《魔鬼沟通学》](docs/魔鬼沟通学.epub) | 表达的分寸：掌握赞美的法则 |
| 邀约 | [《魔鬼沟通学》](docs/魔鬼沟通学.epub) | 有效沟通：如何把担心尴尬的女孩约出来 |
| 平衡（技巧） | [《魔鬼聊天术》](docs/魔鬼聊天术.epub) | 你的女神能追上／平衡的艺术——冰与火的游戏 |
| 行为聊法（技巧） | [《魔鬼聊天术》](docs/魔鬼聊天术.epub) | 如何成为一个善于社交的人？／行为聊法 |
| 状态感受切换法（技巧） | [《魔鬼聊天术》](docs/魔鬼聊天术.epub) | 如何成为一个善于社交的人？ |
| 扩大冲突（技巧） | [《魔鬼聊天术》](docs/魔鬼聊天术.epub) | 你的女神能追上／调情技巧——扩大冲突 |
| 魔趣法则（技巧） | [《魔鬼聊天术》](docs/魔鬼聊天术.epub) | 你的女神能追上／在对话中调动情绪——魔趣法则 |
| 行为一致、夸张引申（技巧名称） | [《魔鬼聊天术》](docs/魔鬼聊天术.epub) | 你一直在错误地“共情”；名称由项目确定 |
| 接话、起头、轻松共情（策略） | 项目自定义 | 无书籍出处 |

### 联系人记录 Skill

[联系人记录 Skill](skills/contact-notes/SKILL.md) 可通过 `$contact-notes` 显式调用，也可由正在进行的中文回复教练 Skill 回复流程自动联动。显式调用可以查看或维护联系人档案。普通聊天中仅提供联系人背景或互动，不自动记录。

独立记录背景时，无需说明本轮回复方式。明确的修改请求直接执行；身份或内容不清时先澄清。只调用 Skill 名而未说明操作时，Skill 会询问要查看或记录什么。

```text
$contact-notes 记一下小林的背景：我们是朋友介绍认识的，她在杭州工作。
$contact-notes 补充小林的互动：昨天线下吃饭，她说这两周准备考试，考完再约。
$contact-notes 修正小林的城市：之前记错了，她在上海。
$contact-notes 删除小林档案中关于城市的信息。
$contact-notes 查看小林的档案。
```

日常接话只需调用 `$chat-reply`。最短输入是 `$chat-reply 小林`。也可用 `$chat-reply 小林 --strategy 共情 --context "我已经回了她一句辛苦啦，想顺着加班的话题再接一句"` 提供本轮材料。主动开场可用 `$chat-reply 小林 --intent 起头 --context "今天刚参加完比赛，结束后觉得挺有意思，想主动和她聊聊"`。自定义组合可用 `$chat-reply 小林 --intent 共情 --principle 非评价式共情 --technique 行为一致`。

接话但未提供待回复消息时，Skill 会按名字查找最近微信聊天。没有可读历史且未提供可用材料时，需补充材料。下面的自然语言调用仍可使用。此例中的“考试结束”会自动保存；示例回复不会被记成已发送消息：

```text
$chat-reply 小林今天刚发来“终于考完了，累死我了”，用共情接话。
```

仍可在同轮显式调用两个 Skill。先执行指定的记录、修正或删除操作，再提供示例回复。自动联动只补充未保存且未被排除的信息。删除的信息不从同轮材料补回；删除整个档案后，本轮不自动重建。

## 安装 Skill

两个 Skill 均可独立安装。运行所需规则位于各自目录。按照 [Codex 官方 Skill 说明](https://learn.chatgpt.com/docs/build-skills)，用户级 Skill 放在 `~/.agents/skills/`：

1. 从仓库的 `skills/` 中选择 `chat-reply`、`contact-notes` 或两者。将所选目录内的全部受版本控制文件复制到 `~/.agents/skills/` 下的同名目录。
2. 保留所选 Skill 的 `SKILL.md`、`references/` 和 `agents/openai.yaml`。安装 `chat-reply` 时，还须保留 `scripts/selection.py`。不能只复制入口文件。安装目录中无需放置仓库的 `docs/`、另一个 Skill 或本机 `contacts` 软链。
3. 在 Codex 中用 `$chat-reply` 开始回复流程。联系人记录 Skill 会在流程内自动联动。独立维护档案时，用 `$contact-notes` 显式调用。新安装的 Skill 未显示时，重启 Codex。

只安装中文回复教练 Skill 时，仍可读取已有联系人档案。没有档案时，继续使用当前聊天材料。首次需要保存时，会提示安装联系人记录 Skill；中文回复教练 Skill 不自行写入档案。要使用自动记录，须安装两个 Skill。只安装联系人记录 Skill 时，仍可独立维护档案。查询微信历史另需配置[微信历史 MCP](mcp-server/README.md)；读取和保存联系人档案不要求连接它。

中文回复教练 Skill 的调用配置为 `allow_implicit_invocation: false`。联系人记录 Skill 的配置为 `true`，并通过描述和流程规则限定为显式调用或回复流程内联动。配置没有按调用方限制的开关。实际触发范围由用户手工验证。

更新时替换所选 Skill 的规则文件，保留用户目录中的联系人档案。现有档案无需迁移。在本仓库内开发时，也可使用已有的 `.agents/skills/` 发现链接。

## 联系人数据与侧边栏

每个联系人对应一个 Markdown 文件，保存在当前用户目录 `~/.chat-coach/contacts/`。背景、当前情况、互动记录和个人观察分开保存。读取方式见[材料读取说明](skills/chat-reply/references/materials.md)；完整格式与维护规则见[联系人档案维护规则](skills/contact-notes/references/contact-notes.md)。微信历史按需查询，不复制全文到档案。当前版本只面向本机 Codex。ChatGPT 无法直接读取这些本机文件。

项目的 `.agents/skills/chat-reply` 和 `.agents/skills/contact-notes` 是指向源码的相对软链。两个 Skill 内可选的 `contacts` 软链指向同一个用户数据目录，供用户在文件侧边栏查看和编辑。运行时直接访问用户数据目录，不依赖这些软链。发现链接随仓库提交；联系人目录链接及数据由 `.gitignore` 排除。

需要在仓库侧边栏查看联系人档案时，在仓库根目录执行以下命令。独立安装 Skill 无需运行。命令会先检查已有路径。路径冲突时，它会报告并退出，不覆盖已有链接或文件。

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

两个 Skill 的规则组织与一致性维护说明见[联系人档案规则索引](docs/contact-notes.md)。该索引仅供开发者使用。

## 微信历史 MCP

[微信历史 MCP](mcp-server/README.md) 同步本机微信消息，并通过只读工具供 MCP 客户端查找会话、分页读取历史。它不调用模型，也不发送微信消息。准备、安装、运行、隧道配置和验证步骤见 [MCP README](mcp-server/README.md)。

## 开发与验证

### 仓库结构

```text
chat-coach/
├── .agents/skills/
│   ├── chat-reply -> ../../skills/chat-reply
│   └── contact-notes -> ../../skills/contact-notes
├── CONTEXT.md
├── docs/
│   ├── chat-reply-manual-tests.md
│   ├── contact-notes.md
│   ├── 魔鬼聊天术.epub
│   └── 魔鬼沟通学.epub
├── mcp-server/
└── skills/
    ├── chat-reply/
    │   ├── SKILL.md
    │   ├── agents/openai.yaml
    │   ├── scripts/selection.py
    │   ├── contacts -> ~/.chat-coach/contacts（仅本机，可选）
    │   └── references/
    │       ├── auto-notes.md
    │       ├── materials.md
    │       ├── review.md
    │       ├── intents/（意图及其专属原则、技巧）
    │       ├── shared/（公共原则、技巧）
    │       └── strategies/（策略）
    └── contact-notes/
        ├── SKILL.md
        ├── agents/openai.yaml
        ├── contacts -> ~/.chat-coach/contacts（仅本机，可选）
        └── references/contact-notes.md
```

| 位置 | 干什么的 |
| --- | --- |
| [CONTEXT.md](CONTEXT.md) | 项目领域术语及同义称呼的取舍。 |
| [docs/chat-reply-manual-tests.md](docs/chat-reply-manual-tests.md) | 可直接复制的手工测试输入。 |
| [mcp-server/](mcp-server/README.md) | 微信历史 MCP 的实现、安装、配置与验证说明。 |
| [skills/chat-reply/SKILL.md](skills/chat-reply/SKILL.md) | 中文回复教练 Skill 入口，定义任务目标与上下文使用方式。 |
| [skills/chat-reply/agents/openai.yaml](skills/chat-reply/agents/openai.yaml) | 仅允许手动调用的配置。 |
| [skills/chat-reply/references/auto-notes.md](skills/chat-reply/references/auto-notes.md) | 回复流程内自动联动记录的时机、交接与异常处理。 |
| [skills/chat-reply/references/materials.md](skills/chat-reply/references/materials.md) | 联系人档案的读取与使用边界，以及微信历史 MCP 的查询用法。 |
| [skills/chat-reply/references/intents/index.md](skills/chat-reply/references/intents/index.md) | 五项正式意图及适用范围。 |
| [skills/chat-reply/references/shared/index.md](skills/chat-reply/references/shared/index.md) | 公共原则与技巧；是否可用由意图清单决定。 |
| [skills/chat-reply/references/strategies/index.md](skills/chat-reply/references/strategies/index.md) | 六套策略的组成。 |
| [skills/chat-reply/scripts/selection.py](skills/chat-reply/scripts/selection.py) | 校验规则归属与本轮选择，返回应读取的规则文档。 |
| [skills/chat-reply/references/review.md](skills/chat-reply/references/review.md) | 示例回复的输出前审查。 |
| [skills/contact-notes/SKILL.md](skills/contact-notes/SKILL.md) | 联系人档案的查看与维护流程。 |
| [skills/contact-notes/agents/openai.yaml](skills/contact-notes/agents/openai.yaml) | 允许自动调用，触发范围由入口描述和流程限定。 |
| [skills/contact-notes/references/contact-notes.md](skills/contact-notes/references/contact-notes.md) | 联系人档案的存储、身份查找、文件格式与维护规则。 |
| [docs/contact-notes.md](docs/contact-notes.md) | 开发者规则索引与两个 Skill 的一致性约定，运行时不引用。 |

### 检查命令

```sh
npm ci --prefix mcp-server
npm test --prefix mcp-server
npm run test:package --prefix mcp-server
```

修改两个 Skill 或联系人档案规则后，用户可按需手工测试。不要求运行自动回复评测或生成评测报告。检查选择结构时，可运行 `python3 skills/chat-reply/scripts/selection.py --check-catalog` 和 `python3 -m unittest discover -s skills/chat-reply/tests`。

仅修改 Skill、文档或配置时，检查 frontmatter、调用配置、引用链接、软链和 Git 忽略规则。将两个 Skill 的受版本控制文件分别复制到隔离临时目录，确认运行规则链接均位于各自目录内且有效。涉及联系人档案格式或查找规则时，按[规则索引](docs/contact-notes.md)核对两边兼容性。现有 CI 会运行 MCP 测试和独立包验证。

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
| 在新聊天中只用 `$chat-reply` 回复已记录的联系人，并提供新背景。 | 自动保存增量后按本轮选择或默认的“接话”策略提供示例；成功时静默，已有信息不重复追加。 |
| 只用 `$chat-reply` 回复身份明确、没有档案的联系人。 | 有可保存信息时自动建档；未选择时默认“接话”策略。 |
| 未选择策略或单项，或连续交互中补充背景和实际互动。 | 取得新材料时及时保存新信息；未选择时默认“接话”策略，无需重复调用两个 Skill。 |
| 本轮查到微信历史，再重复查询同一段历史。 | 保存有用摘要及来源和日期，不重复追加，不为记录额外查询；旧状态不覆盖较新的当前情况。 |
| 提供打算、选择策略或单项、调整示例回复，之后说明消息已经发送。 | 打算与实际互动区分，所选意图、原则、技巧、策略及示例回复不入档；确认已发送后才记录实际互动。 |
| 有档案但未指定回复方式，或档案包含历史意愿和个人观察。 | 默认“接话”策略；历史意愿不自动成为本轮承诺，个人观察不当作确定事实。 |
| 同轮显式调用两个 Skill，要求记录、修正或删除并生成回复。 | 先执行明确操作，再核对自动增量；不重复记录，不补回同轮删除的信息或重建已删除档案。 |
| 要求本轮或指定信息不记录；身份有歧义或信息冲突无法解释。 | 遵从记录限制；歧义先澄清，澄清前不猜测写入。 |
| 联系人记录 Skill 写入失败或保存结果无法核对。 | 简短说明失败并继续回复，不声称已保存。 |
| 新聊天中未调用任何 Skill，仅描述联系人背景或互动；或回复流程结束后转为其他任务。 | 不触发自动记录。 |

提交前确认暂存区只包含 Skill、文档、配置和相对发现软链，不包含联系人档案或绝对路径软链。
