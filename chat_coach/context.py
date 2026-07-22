"""从 Bitable 读取聊天历史."""

import json
import subprocess
import sys

from chat_coach.config import get as _cfg


def _run_lark(base_args: list[str]) -> dict:
    """Run lark-cli base subcommand, return parsed JSON."""
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
        print(f"[context] lark-cli 调用失败: {result.stderr[:500]}", file=sys.stderr)
        return {}
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        print(f"[context] lark-cli 返回解析失败: {result.stdout[:200]}", file=sys.stderr)
        return {}


def get_history(limit: int = 20) -> list[dict]:
    """返回最近 N 条聊天记录，格式 [{"role": "them/me", "content": "..."}]."""
    base_token = _cfg("base_token")
    table_id = _cfg("history_table_id")
    view_name = _cfg("history_view_name", "Grid View")

    resp = _run_lark([
        "+record-list",
        "--base-token", base_token,
        "--table-id", table_id,
        "--view-id", view_name,
    ])

    if not resp:
        return []

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

    if len(entries) > limit:
        entries = entries[-limit:]

    return entries
