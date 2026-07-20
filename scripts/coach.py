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
