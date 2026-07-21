#!/usr/bin/env python3
"""Initialize the Chat Coach Bitable base on Feishu.

Creates the base and history table if they don't already exist,
then writes the config to data/config.json.

Usage:
  python3 scripts/setup_base.py
"""

import json
import subprocess
import sys
from pathlib import Path

CONFIG_PATH = Path(__file__).resolve().parent.parent / "data" / "config.json"
HISTORY_FIELDS = [
    {"type": "select", "name": "Role", "multiple": False,
     "options": [{"name": "对方"}, {"name": "我"}]},
    {"type": "text", "name": "Content"},
]


def run_lark(args: list[str]) -> dict:
    cmd = ["lark-cli", "base"] + args + ["--as", "user", "--format", "json"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"lark-cli 失败: {r.stderr[:300]}")
        sys.exit(1)
    return json.loads(r.stdout)


def main():
    if CONFIG_PATH.exists():
        print(f"配置文件已存在: {CONFIG_PATH}")
        cfg = json.loads(CONFIG_PATH.read_text())
        print(f"Base: https://my.feishu.cn/base/{cfg['base_token']}")
        return

    print("创建 Chat Coach 多维表格...")

    # 1. Create base with history table
    resp = run_lark([
        "+base-create",
        "--name", "Chat Coach",
        "--time-zone", "Asia/Shanghai",
        "--table-name", "history",
        f"--fields={json.dumps(HISTORY_FIELDS)}",
    ])
    if not resp.get("ok"):
        print(f"创建 Base 失败: {resp}")
        sys.exit(1)

    base_token = resp["data"]["base"]["base_token"]
    history_table_id = resp["data"]["table"]["id"]
    print(f"Base 创建成功: {resp['data']['base']['url']}")

    # 2. Get field IDs for history table
    r = run_lark([
        "+field-list", "--base-token", base_token, "--table-id", history_table_id,
    ])
    history_fields = {f["name"]: f["id"] for f in r["data"]["fields"]}

    # 3. Write config
    config = {
        "base_token": base_token,
        "history_table_id": history_table_id,
        "history_fields": history_fields,
    }
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(config, ensure_ascii=False, indent=2))
    print(f"配置文件已写入: {CONFIG_PATH}")

    print(f"\n完成！访问: https://my.feishu.cn/base/{base_token}")


if __name__ == "__main__":
    main()
