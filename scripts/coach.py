#!/usr/bin/env python3
"""chat-coach helper: read chat history from Feishu Bitable."""

import json
import subprocess
import sys

from config import get as _cfg

BASE_TOKEN = _cfg("base_token")
HISTORY_TABLE = _cfg("history_table_id")
HISTORY_VIEW = _cfg("history_view_name", "Grid View")


def _run_lark(base_args: list[str]) -> dict:
    """Run lark-cli base subcommand, return parsed JSON response."""
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


def _get_all_history() -> list[dict]:
    """Return all history records, sorted by Time."""
    resp = _run_lark([
        "+record-list",
        "--base-token", BASE_TOKEN,
        "--table-id", HISTORY_TABLE,
        "--view-id", HISTORY_VIEW,
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

        if "content" in entry:
            entries.append(entry)

    return entries


def cmd_context() -> None:
    """Print all chat history."""
    history = _get_all_history()

    if not history:
        print("暂无聊天记录")
        return

    for e in history:
        label = "对方" if e["role"] == "them" else "我"
        print(f"{label}: {e['content']}")


HANDLERS = {"context": cmd_context}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in HANDLERS:
        print(f"用法: coach.py <{'|'.join(HANDLERS)}>")
        sys.exit(1)
    HANDLERS[sys.argv[1]]()
