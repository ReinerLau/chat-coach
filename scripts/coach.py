#!/usr/bin/env python3
"""chat-coach helper: manage contacts and history via Feishu Bitable."""

import json
import subprocess
import sys
from datetime import date

from config import get as _cfg

BASE_TOKEN = _cfg("base_token")
CONTACTS_TABLE = _cfg("contacts_table_id")
HISTORY_TABLE = _cfg("history_table_id")


def _run_lark(base_args: list[str]) -> dict:
    """Run lark-cli base subcommand, return parsed JSON response."""
    # merge --json flag with its value: lark-cli needs --json=value not --json value
    merged = []
    skip = False
    for i, arg in enumerate(base_args):
        if skip:
            skip = False
            continue
        if arg == "--json" and i + 1 < len(base_args):
            merged.append(f"--json={base_args[i + 1]}")
            skip = True
        else:
            merged.append(arg)

    cmd = ["lark-cli", "base"] + merged + ["--as", "user", "--format", "json"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"lark-cli 调用失败: {result.stderr[:500]}")
        sys.exit(1)
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        print(f"lark-cli 返回解析失败: {result.stdout[:200]}")
        sys.exit(1)


def _parse_date(val: str | None) -> str:
    """Parse datetime string from Bitable to YYYY-MM-DD."""
    if not val:
        return ""
    if " " in val:
        return val.split(" ")[0]
    return val


# ── Contact record helpers ────────────────────────────────────────────

def _get_contact(name: str) -> dict | None:
    """Query contacts table by Name, return record dict with _record_id or None."""
    resp = _run_lark([
        "+record-list",
        "--base-token", BASE_TOKEN,
        "--table-id", CONTACTS_TABLE,
        "--filter-json", json.dumps({"logic": "and", "conditions": [["Name", "==", name]]}),
    ])
    data = resp.get("data", {})
    rows = data.get("data", [])
    if not rows:
        return None
    fields = data["fields"]
    field_ids = data["field_id_list"]
    record_id = data["record_id_list"][0]
    row = rows[0]

    rec = {"_record_id": record_id}
    for i, fname in enumerate(fields):
        val = row[i] if i < len(row) else None
        if fname == "Name":
            rec["name"] = val or ""
        elif fname == "Tags":
            rec["tags"] = val if isinstance(val, list) else []
        elif fname == "Goal":
            rec["goal"] = val or ""
        elif fname == "Notes":
            rec["notes"] = val or ""
        elif fname == "Last Contact":
            rec["last_contact"] = _parse_date(val)
        elif fname == "Remind Interval":
            rec["remind_interval_days"] = val if val is not None else 7
    return rec


def _create_contact(data: dict) -> str:
    """Insert a new contact record. Returns record_id."""
    resp = _run_lark([
        "+record-upsert",
        "--base-token", BASE_TOKEN,
        "--table-id", CONTACTS_TABLE,
        "--json", json.dumps({
            "Name": data["name"],
            "Tags": data.get("tags", []),
            "Goal": data.get("goal", ""),
            "Notes": data.get("notes", ""),
            "Last Contact": data.get("last_contact", str(date.today())),
            "Remind Interval": data.get("remind_interval_days", 7),
        }, ensure_ascii=False),
    ])
    return resp["data"]["record"]["record_id_list"][0]


def _update_contact(record_id: str, fields: dict) -> None:
    """Update contact record fields."""
    _run_lark([
        "+record-upsert",
        "--base-token", BASE_TOKEN,
        "--table-id", CONTACTS_TABLE,
        "--record-id", record_id,
        "--json", json.dumps(fields, ensure_ascii=False),
    ])


def _list_contacts() -> list[dict]:
    """Return all contact records with _record_id."""
    resp = _run_lark([
        "+record-list",
        "--base-token", BASE_TOKEN,
        "--table-id", CONTACTS_TABLE,
    ])
    data = resp.get("data", {})
    rows = data.get("data", [])
    fields = data.get("fields", [])
    records = data.get("record_id_list", [])

    results = []
    for ri, row in enumerate(rows):
        rec = {"_record_id": records[ri] if ri < len(records) else None}
        for i, fname in enumerate(fields):
            val = row[i] if i < len(row) else None
            if fname == "Name":
                rec["name"] = val or ""
            elif fname == "Tags":
                rec["tags"] = val if isinstance(val, list) else []
            elif fname == "Goal":
                rec["goal"] = val or ""
            elif fname == "Notes":
                rec["notes"] = val or ""
            elif fname == "Last Contact":
                rec["last_contact"] = _parse_date(val)
            elif fname == "Remind Interval":
                rec["remind_interval_days"] = val if val is not None else 7
        results.append(rec)
    return results


# ── History record helpers ────────────────────────────────────────────

def _get_history(contact_record_id: str) -> list[dict]:
    """Return all history entries for a contact, sorted by Time."""
    resp = _run_lark([
        "+record-list",
        "--base-token", BASE_TOKEN,
        "--table-id", HISTORY_TABLE,
    ])
    data = resp.get("data", {})
    rows = data.get("data", [])
    fields = data.get("fields", [])

    entries = []
    for row in rows:
        entry = {}
        for i, fname in enumerate(fields):
            val = row[i] if i < len(row) else None
            if fname == "Role":
                entry["role"] = "them" if val and "对方" in str(val) else "me"
            elif fname == "Content":
                entry["content"] = val or ""
            elif fname == "Time":
                entry["time"] = _parse_date(val)
            elif fname == "Contact":
                linked_ids = []
                if isinstance(val, list):
                    for item in val:
                        if isinstance(item, dict) and "id" in item:
                            linked_ids.append(item["id"])
                if contact_record_id not in linked_ids:
                    entry = None
                    break
        if entry:
            entries.append(entry)

    entries.sort(key=lambda e: e.get("time", ""))
    return entries


def _add_history(contact_record_id: str, entries: list[dict]) -> None:
    """Batch insert history records linked to a contact."""
    for entry in entries:
        _run_lark([
            "+record-upsert",
            "--base-token", BASE_TOKEN,
            "--table-id", HISTORY_TABLE,
            "--json", json.dumps({
                "Contact": [{"id": contact_record_id}],
                "Role": "对方" if entry["role"] == "them" else "我",
                "Content": entry["content"],
                "Time": entry["time"],
            }, ensure_ascii=False),
        ])


def _count_history(contact_record_id: str) -> int:
    """Count history records for a contact by scanning all records."""
    resp = _run_lark([
        "+record-list",
        "--base-token", BASE_TOKEN,
        "--table-id", HISTORY_TABLE,
    ])
    data = resp.get("data", {})
    rows = data.get("data", [])
    fields = data.get("fields", [])

    contact_idx = None
    for i, fname in enumerate(fields):
        if fname == "Contact":
            contact_idx = i
            break
    if contact_idx is None:
        return 0

    count = 0
    for row in rows:
        val = row[contact_idx] if contact_idx < len(row) else None
        if isinstance(val, list):
            for item in val:
                if isinstance(item, dict) and item.get("id") == contact_record_id:
                    count += 1
                    break
    return count


# ── Core data layer (compatible with original interface) ──────────────

def _load(name: str) -> dict:
    """Load contact by name from Bitable. Exits if not found."""
    rec = _get_contact(name)
    if not rec:
        print(f"联系人 {name} 不存在")
        sys.exit(1)
    return rec


def _save(name: str, data: dict) -> None:
    """Persist contact-level fields to Bitable."""
    record_id = data.get("_record_id")
    if not record_id:
        return
    _update_contact(record_id, {
        "Name": data.get("name", name),
        "Tags": data.get("tags", []),
        "Goal": data.get("goal", ""),
        "Notes": data.get("notes", ""),
        "Last Contact": data.get("last_contact", str(date.today())),
        "Remind Interval": data.get("remind_interval_days", 7),
    })


# ── Commands ──────────────────────────────────────────────────────────

def cmd_add(name: str) -> None:
    if _get_contact(name):
        print(f"联系人 {name} 已存在")
        sys.exit(1)
    data = {
        "name": name,
        "tags": [],
        "goal": "",
        "notes": "",
        "history": [],
        "last_contact": str(date.today()),
        "remind_interval_days": 7,
    }
    _create_contact(data)
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
    contacts = _list_contacts()
    if not contacts:
        print("暂无联系人")
        return
    today = date.today()
    for rec in contacts:
        name = rec.get("name", "?")
        tags = ", ".join(rec.get("tags", []))
        last = rec.get("last_contact", "?")
        interval = rec.get("remind_interval_days", 7)
        goal = rec.get("goal", "")
        rid = rec.get("_record_id", "")
        count = _count_history(rid) if rid else 0
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
    rid = d.get("_record_id", "")
    count = _count_history(rid) if rid else 0
    print(f"姓名: {d['name']}")
    print(f"标签: {', '.join(d.get('tags', [])) or '(无)'}")
    print(f"目标: {d.get('goal') or '(未设置)'}")
    print(f"备注: {d.get('notes') or '(无)'}")
    print(f"最近联系: {d.get('last_contact', '?')}")
    print(f"提醒间隔: {d.get('remind_interval_days', 7)} 天")
    print(f"聊天记录数: {count}")


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

    record_id = data["_record_id"]
    _add_history(record_id, entries)
    _update_contact(record_id, {"Last Contact": str(date.today())})

    print(f"已记录 {len(entries)} 条对话")


def cmd_history(name: str) -> None:
    data = _load(name)
    record_id = data["_record_id"]
    for e in _get_history(record_id):
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
