#!/usr/bin/env python3
"""Initialize the Chat Coach Bitable base on Feishu.

Creates the base, contacts table, and history table if they don't already exist,
then writes the config to data/config.json.

Usage:
  python3 scripts/setup_base.py
"""

import json
import subprocess
import sys
from pathlib import Path

CONFIG_PATH = Path(__file__).resolve().parent.parent / "data" / "config.json"
CONTACTS_FIELDS = [
    {"type": "text", "name": "Name"},
    {"type": "select", "name": "Tags", "multiple": True, "options": []},
    {"type": "text", "name": "Goal"},
    {"type": "text", "name": "Notes"},
    {"type": "datetime", "name": "Last Contact", "style": {"format": "yyyy-MM-dd"}},
    {"type": "number", "name": "Remind Interval",
     "style": {"type": "plain", "precision": 0}},
]


def run_lark(args: list[str]) -> dict:
    cmd = ["lark-cli", "base"] + args + ["--as", "user", "--format", "json"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"lark-cli 失败: {r.stderr[:300]}")
        sys.exit(1)
    return json.loads(r.stdout)


def migrate_existing_data(base_token: str, contacts_table_id: str, history_table_id: str) -> int:
    """Migrate data from local data/contacts/*.json to Bitable. Returns count."""
    data_dir = Path(__file__).resolve().parent.parent / "data" / "contacts"
    if not data_dir.exists():
        return 0

    json_files = list(data_dir.glob("*.json"))
    if not json_files:
        return 0

    print(f"发现 {len(json_files)} 个本地联系人，开始迁移...")
    for pf in sorted(json_files):
        d = json.loads(pf.read_text())
        name = d.get("name", pf.stem)

        # Create contact record
        r = subprocess.run([
            "lark-cli", "base", "+record-upsert",
            "--as", "user", "--format", "json",
            "--base-token", base_token,
            "--table-id", contacts_table_id,
            f"--json={json.dumps({
                'Name': name,
                'Tags': d.get('tags', []),
                'Goal': d.get('goal', ''),
                'Notes': d.get('notes', ''),
                'Last Contact': d.get('last_contact', ''),
                'Remind Interval': d.get('remind_interval_days', 7),
            }, ensure_ascii=False)}",
        ], capture_output=True, text=True)

        if r.returncode != 0:
            print(f"  {name}: 创建失败 - {r.stderr[:100]}")
            continue

        resp = json.loads(r.stdout)
        if not resp.get("ok"):
            print(f"  {name}: 创建失败 - {resp}")
            continue

        contact_record_id = resp["data"]["record"]["record_id_list"][0]

        # Migrate history
        history = d.get("history", [])
        migrated = 0
        for entry in history:
            hr = subprocess.run([
                "lark-cli", "base", "+record-upsert",
                "--as", "user", "--format", "json",
                "--base-token", base_token,
                "--table-id", history_table_id,
                f"--json={json.dumps({
                    'Contact': [{'id': contact_record_id}],
                    'Role': '对方' if entry.get('role') == 'them' else '我',
                    'Content': entry.get('content', ''),
                    'Time': entry.get('time', ''),
                }, ensure_ascii=False)}",
            ], capture_output=True, text=True)
            if hr.returncode == 0 and json.loads(hr.stdout).get("ok"):
                migrated += 1

        print(f"  {name}: 已迁移 ({len(history)} 条消息中 {migrated} 条成功)")

    return len(json_files)


def main():
    if CONFIG_PATH.exists():
        print(f"配置文件已存在: {CONFIG_PATH}")
        cfg = json.loads(CONFIG_PATH.read_text())
        print(f"Base: https://my.feishu.cn/base/{cfg['base_token']}")
        return

    print("创建 Chat Coach 多维表格...")

    # 1. Create base
    resp = run_lark([
        "+base-create",
        "--name", "Chat Coach",
        "--time-zone", "Asia/Shanghai",
        "--table-name", "contacts",
        f"--fields={json.dumps(CONTACTS_FIELDS)}",
    ])
    if not resp.get("ok"):
        print(f"创建 Base 失败: {resp}")
        sys.exit(1)

    base_token = resp["data"]["base"]["base_token"]
    contacts_table_id = resp["data"]["table"]["id"]
    print(f"Base 创建成功: {resp['data']['base']['url']}")

    # 2. Create history table
    resp2 = run_lark([
        "+table-create",
        "--base-token", base_token,
        "--name", "history",
        f"--fields={json.dumps([
            {'type': 'link', 'name': 'Contact', 'link_table': contacts_table_id},
            {'type': 'select', 'name': 'Role', 'multiple': False,
             'options': [{'name': '对方'}, {'name': '我'}]},
            {'type': 'text', 'name': 'Content'},
            {'type': 'datetime', 'name': 'Time', 'style': {'format': 'yyyy-MM-dd'}},
        ])}",
    ])
    if not resp2.get("ok"):
        print(f"创建 history 表失败: {resp2}")
        sys.exit(1)

    history_table_id = resp2["data"]["table"]["id"]
    print(f"history 表创建成功")

    # 3. Get field IDs
    def get_fields(table_id):
        r = run_lark([
            "+field-list", "--base-token", base_token, "--table-id", table_id,
        ])
        return {f["name"]: f["id"] for f in r["data"]["fields"]}

    contacts_fields = get_fields(contacts_table_id)
    history_fields = get_fields(history_table_id)

    # 4. Write config
    config = {
        "base_token": base_token,
        "contacts_table_id": contacts_table_id,
        "history_table_id": history_table_id,
        "contacts_fields": contacts_fields,
        "history_fields": history_fields,
    }
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    CONFIG_PATH.write_text(json.dumps(config, ensure_ascii=False, indent=2))
    print(f"配置文件已写入: {CONFIG_PATH}")

    # 5. Migrate existing local data
    migrate_existing_data(base_token, contacts_table_id, history_table_id)

    print(f"\n完成！访问: https://my.feishu.cn/base/{base_token}")


if __name__ == "__main__":
    main()
