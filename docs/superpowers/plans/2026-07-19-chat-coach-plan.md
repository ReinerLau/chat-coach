# chat-coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a chat reply coach bot (Claude Code via Feishu bridge) that manages contacts, logs chat history, and generates natural-sounding reply suggestions with anti-AI voice constraints.

**Architecture:** Two files — `scripts/coach.py` (CLI helper for JSON file CRUD) and `CLAUDE.md` (bot behavior + reply generation prompt). Contact data stored as per-contact JSON files under `data/contacts/`. No backend, no database, no API integration.

**Tech Stack:** Python 3 (stdlib only — json, pathlib, sys, datetime), Claude Code via bridge

---

### Task 1: Create directory structure

**Files:**
- Create: `data/contacts/.gitkeep`

- [ ] **Step 1: Create directories**

```bash
mkdir -p data/contacts
touch data/contacts/.gitkeep
```

- [ ] **Step 2: Verify**

```bash
ls -la data/contacts/.gitkeep
```

### Task 2: Write coach.py — CRUD helper script

**Files:**
- Create: `scripts/coach.py`

- [ ] **Step 1: Write coach.py**

```python
#!/usr/bin/env python3
"""chat-coach helper: CRUD contact JSON files."""

import json
import sys
from datetime import date
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "contacts"


def _path(name: str) -> Path:
    return DATA_DIR / f"{name}.json"


def _load(name: str) -> dict:
    p = _path(name)
    if not p.exists():
        print(f"联系人 {name} 不存在")
        sys.exit(1)
    return json.loads(p.read_text())


def _save(name: str, data: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    _path(name).write_text(json.dumps(data, ensure_ascii=False, indent=2))


def cmd_add(name: str) -> None:
    if _path(name).exists():
        print(f"联系人 {name} 已存在")
        sys.exit(1)
    _save(name, {
        "name": name,
        "tags": [],
        "goal": "",
        "history": [],
        "notes": "",
        "last_contact": str(date.today()),
        "remind_interval_days": 7,
    })
    print(f"已添加联系人: {name}")


def cmd_tag(name: str, *tags: str) -> None:
    data = _load(name)
    data["tags"] = list(tags)
    _save(name, data)
    print(f"{name} 标签已更新: {', '.join(tags)}")


def cmd_goal(name: str, *text: str) -> None:
    data = _load(name)
    data["goal"] = " ".join(text)
    _save(name, data)
    print(f"{name} 目标已更新: {data['goal']}")


def cmd_note(name: str, *text: str) -> None:
    data = _load(name)
    data["notes"] = " ".join(text)
    _save(name, data)
    print(f"{name} 备注已更新")


def cmd_remind(name: str, days: str) -> None:
    data = _load(name)
    data["remind_interval_days"] = int(days)
    _save(name, data)
    print(f"{name} 提醒间隔已设为 {days} 天")


def cmd_list() -> None:
    if not DATA_DIR.exists() or not list(DATA_DIR.glob("*.json")):
        print("暂无联系人")
        return
    today = date.today()
    for p in sorted(DATA_DIR.glob("*.json")):
        d = json.loads(p.read_text())
        name = d["name"]
        tags = ", ".join(d.get("tags", []))
        last = d.get("last_contact", "?")
        interval = d.get("remind_interval_days", 7)
        goal = d.get("goal", "")
        count = len(d.get("history", []))
        warn = ""
        if last and last != "?":
            try:
                days_since = (today - date.fromisoformat(last)).days
                if days_since >= interval:
                    warn = f"  [!! {days_since}天未联系]"
            except ValueError:
                pass
        print(f"  {name}  |  {tags}  |  最近: {last}  |  消息数: {count}{warn}")
        if goal:
            print(f"    目标: {goal}")


def cmd_info(name: str) -> None:
    d = _load(name)
    print(f"姓名: {d['name']}")
    print(f"标签: {', '.join(d.get('tags', [])) or '(无)'}")
    print(f"目标: {d.get('goal') or '(未设置)'}")
    print(f"备注: {d.get('notes') or '(无)'}")
    print(f"最近联系: {d.get('last_contact', '?')}")
    print(f"提醒间隔: {d.get('remind_interval_days', 7)} 天")
    print(f"聊天记录数: {len(d.get('history', []))}")


def cmd_log(name: str, *text: str) -> None:
    data = _load(name)
    raw = " ".join(text)
    entries = []
    for line in raw.split("\\n"):
        line = line.strip()
        if not line:
            continue
        if line.startswith("对方:") or line.startswith("对方："):
            entries.append({"role": "them", "content": line[3:].strip(), "time": str(date.today())})
        elif line.startswith("我:") or line.startswith("我："):
            entries.append({"role": "me", "content": line[2:].strip(), "time": str(date.today())})
    if not entries:
        entries.append({"role": "them", "content": raw, "time": str(date.today())})
    data["history"].extend(entries)
    data["last_contact"] = str(date.today())
    _save(name, data)
    print(f"已记录 {len(entries)} 条对话")


def cmd_history(name: str) -> None:
    data = _load(name)
    for e in data.get("history", []):
        label = "对方" if e["role"] == "them" else "我"
        print(f"[{e['time']}] {label}: {e['content']}")


HANDLERS = {
    "add": cmd_add, "tag": cmd_tag, "goal": cmd_goal,
    "note": cmd_note, "remind": cmd_remind, "list": cmd_list,
    "info": cmd_info, "log": cmd_log, "history": cmd_history,
}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in HANDLERS:
        print(f"用法: coach.py <{'|'.join(HANDLERS)}> [args...]")
        sys.exit(1)
    HANDLERS[sys.argv[1]](*sys.argv[2:])
```

- [ ] **Step 2: Make it executable and smoke test**

```bash
chmod +x scripts/coach.py
python3 scripts/coach.py
```

Expected: prints usage line with available commands.

- [ ] **Step 3: End-to-end test of all commands**

```bash
python3 scripts/coach.py add 测试
python3 scripts/coach.py tag 测试 朋友 同事
python3 scripts/coach.py goal 测试 保持联系
python3 scripts/coach.py note 测试 喜欢打篮球
python3 scripts/coach.py remind 测试 14
python3 scripts/coach.py log 测试 "对方: 你好\n我: 嗨"
python3 scripts/coach.py info 测试
python3 scripts/coach.py history 测试
python3 scripts/coach.py list
```

Expected: all commands succeed with readable output.

- [ ] **Step 4: Clean up test data**

```bash
rm data/contacts/测试.json
```

### Task 3: Write CLAUDE.md — Bot behavior spec

**Files:**
- Overwrite: `CLAUDE.md`

**Note:** The existing `CLAUDE.md` is a simple test bot. Replace it with the full chat-coach spec.

- [ ] **Step 1: Write CLAUDE.md**

```markdown
# chat-coach

You are a chat reply coach. Your job: help the user reply to messages naturally.

## How you work

The user manages contacts with you via commands. Each contact is a JSON file under `data/contacts/`. You read/write these files through `scripts/coach.py` or by reading the JSON directly.

## Commands

You handle these slash commands:

### Contact Management
- `/add <name>` — Create a new contact. Run: `python3 scripts/coach.py add <name>`
- `/tag <name> <t1> <t2> ...` — Set relationship tags. Run: `python3 scripts/coach.py tag <name> <t1> <t2> ...`
- `/goal <name> <text>` — Set relationship goal. Run: `python3 scripts/coach.py goal <name> <text>`
- `/note <name> <text>` — Set freeform notes. Run: `python3 scripts/coach.py note <name> <text>`
- `/remind <name> <days>` — Set reminder interval in days. Run: `python3 scripts/coach.py remind <name> <days>`
- `/list` — List all contacts with status. Run: `python3 scripts/coach.py list`
- `/info <name>` — Show full contact profile. Run: `python3 scripts/coach.py info <name>`

### Chat History
- `/log <name> <text>` — Append conversation to history. Format: separate lines with "对方:" or "我:" prefix. Run: `python3 scripts/coach.py log <name> <text>`
- `/history <name>` — Show chat history. Run: `python3 scripts/coach.py history <name>`

### Core Feature
- `/reply <name>` — Generate 2-3 natural reply suggestions. See reply rules below.

## Reply generation rules

When the user says `/reply <name>`:

1. **Read the contact file** at `data/contacts/<name>.json` to get tags, goal, history, notes
2. **Understand the context**: who they are, what's the relationship, what's the goal, what was the last conversation
3. **Generate 2-3 reply options** following the anti-AI rules below
4. **Label each option** with a style tag: [随意] [正式] [推进关系]

### Anti-AI voice rules (MANDATORY)

Your replies must sound like a real person talking, not AI. Follow these rules strictly:

1. **Length varies**: sometimes 1-2 characters ("行", "好", "嗯"), sometimes longer. No uniform length.
2. **Spoken language**: use 呗, 嘛, 吧, 哈哈, 嗯, 哦, 害, 我去, 笑死 — these are normal in Chinese chat
3. **No templates**: don't follow "greeting → body → closing" structure. Break patterns.
4. **Imperfect grammar**: omit subjects, use fragments, drop periods. Real people don't write perfect prose.
5. **Real emotions**: allow teasing, hesitation, surprise. Not everything is "wonderful" or "amazing".
6. **Match distance**: casual with friends, restrained with bosses. Read the contact tags.
7. **Push forward when natural**: if the goal suggests it, take initiative — invite, ask back, show interest.

### BANNED phrases (never use these)

"当然可以", "很高兴为您", "综上所述", "请问", "非常抱歉", "感谢您的理解", "期待与您", "欣然接受", "看起来非常美味", "色香味俱全", "堪比餐厅水平", "看得出来你是个热爱生活的人"

### Reply format

Present replies like this:

```
[随意] 周末可以啊 去哪吃
[正式] 周六有空 你定个时间？
[推进关系] 行 好久没见了 这周必须约
```

Keep each option under 50 characters. One line per option. No explanations or analysis unless the user asks.

## Reminder check

When running `/list` or after `/reply`, if a contact's `last_contact` is older than `remind_interval_days`, mention it briefly: "btw 小王 7 天没联系了，要主动打个招呼吗？"

## Style

- Use Chinese by default
- Be terse and direct — you're a tool, not a companion
- No emojis unless the user uses them first
- No "glad to help" or "let me know if you need anything" endings
```

- [ ] **Step 2: Verify CLAUDE.md is in place**

```bash
wc -l CLAUDE.md
```

Expected: roughly 80-90 lines.

### Task 4: Final verification

- [ ] **Step 1: Verify complete project structure**

```bash
find . -type f | sort
```

Expected:
```
./CLAUDE.md
./data/contacts/.gitkeep
./docs/superpowers/plans/2026-07-19-chat-coach-plan.md
./docs/superpowers/specs/2026-07-19-chat-coach-design.md
./scripts/coach.py
```

- [ ] **Step 2: Final smoke test**

```bash
python3 scripts/coach.py add 小王 && python3 scripts/coach.py list && python3 scripts/coach.py info 小王 && rm data/contacts/小王.json
```

Expected: clean add → list → info → delete cycle.
