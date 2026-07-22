"""向 Bitable 写入聊天记录."""

import json
import subprocess
import sys

from chat_coach.config import get as _cfg


def _run_lark(base_args: list[str]) -> bool:
    """Run lark-cli base subcommand, return True on success."""
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
        print(f"[writer] lark-cli 调用失败: {result.stderr[:500]}", file=sys.stderr)
        return False
    return True


def add_entry(role: str, content: str) -> bool:
    """向 Bitable 添加一条聊天记录.

    Args:
        role: "them" 或 "me"
        content: 消息内容
    """
    base_token = _cfg("base_token")
    table_id = _cfg("history_table_id")
    fields_config = _cfg("history_fields", {})

    role_field = fields_config.get("Role", "")
    content_field = fields_config.get("Content", "")

    if not all([base_token, table_id, role_field, content_field]):
        print("[writer] Bitable 配置不完整", file=sys.stderr)
        return False

    role_value = "对方" if role == "them" else "我"

    field_values = json.dumps({
        role_field: role_value,
        content_field: content,
    })

    return _run_lark([
        "+record-upsert",
        "--base-token", base_token,
        "--table-id", table_id,
        "--json", field_values,
    ])
