"""Tests for coach.py with mocked lark-cli calls."""

import json
import sys
from datetime import date
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import coach


# ── Helpers for building fake Bitable API responses ───────────────────

def _make_contacts_response(records: list[dict]) -> dict:
    """Build a +record-list response for the contacts table."""
    fields = ["Name", "Tags", "Goal", "Notes", "Last Contact", "Remind Interval"]
    data_rows = []
    record_ids = []
    for rec in records:
        record_ids.append(rec.pop("_record_id"))
        data_rows.append([
            rec.get("Name", rec.get("name", "")),
            rec.get("Tags", rec.get("tags", [])),
            rec.get("Goal", rec.get("goal", "")),
            rec.get("Notes", rec.get("notes", "")),
            rec.get("Last Contact", rec.get("last_contact", "")),
            rec.get("Remind Interval", rec.get("remind_interval_days", 7)),
        ])
    return {
        "ok": True,
        "data": {
            "data": data_rows,
            "fields": fields,
            "field_id_list": [
                "fldMVgUpGg", "fldUJapZWW", "fldcjzyUwj",
                "fldOVOTES3", "fldxk9z3F4", "fldWDTpl9P",
            ],
            "record_id_list": record_ids,
            "has_more": False,
        },
    }


def _make_upsert_response(record_id: str, created: bool = False) -> dict:
    return {
        "ok": True,
        "data": {
            "created": created,
            "record": {"record_id_list": [record_id]},
        },
    }


def _make_history_response(records: list[dict]) -> dict:
    """Build a +record-list response for the history table."""
    fields = ["Contact", "Content", "Role", "Time"]
    data_rows = []
    record_ids = []
    for rec in records:
        record_ids.append(rec.pop("_record_id"))
        data_rows.append([
            rec.get("Contact", []),
            rec.get("Content", ""),
            rec.get("Role", []),
            rec.get("Time", ""),
        ])
    return {
        "ok": True,
        "data": {
            "data": data_rows,
            "fields": fields,
            "field_id_list": [
                "fldM9bWBzX", "fldXbZ9K6l", "fldPx4NWmO", "fldbmZtyyn",
            ],
            "record_id_list": record_ids,
            "has_more": False,
        },
    }


def _empty_contacts_response() -> dict:
    return _make_contacts_response([])


def _empty_history_response() -> dict:
    return _make_history_response([])


# ── Fixture: stateful mock of _run_lark ───────────────────────────────

@pytest.fixture
def mock_lark():
    """Replace coach._run_lark with a stateful in-memory store."""
    contacts = {}  # record_id -> record dict
    history = {}   # record_id -> record dict
    _next_id = 0

    def next_id():
        nonlocal _next_id
        _next_id += 1
        return f"rec_test_{_next_id:03d}"

    def _parse_payload(args):
        """Extract JSON payload from args, handling both --json=<value> and --json <value>."""
        for i, a in enumerate(args):
            if a.startswith("--json="):
                return json.loads(a.split("=", 1)[1])
            if a == "--json" and i + 1 < len(args):
                return json.loads(args[i + 1])
        return None

    def run_lark_impl(args: list[str]) -> dict:
        cmd = args[0]

        if cmd == "+record-upsert":
            rid = None
            table_id = None
            for i, a in enumerate(args):
                if a == "--record-id":
                    rid = args[i + 1]
                elif a == "--table-id":
                    table_id = args[i + 1]

            payload = _parse_payload(args) or {}
            store = history if table_id == coach.HISTORY_TABLE else contacts

            if rid and rid in store:
                for k, v in payload.items():
                    store[rid][k] = v
                return _make_upsert_response(rid)
            elif not rid:
                rid = next_id()
                store[rid] = dict(payload)
                return _make_upsert_response(rid, created=True)
            else:
                return {"ok": False}

        elif cmd == "+record-list":
            table_id = None
            for i, a in enumerate(args):
                if a == "--table-id":
                    table_id = args[i + 1]

            if table_id == coach.HISTORY_TABLE:
                return _make_history_response([
                    {"_record_id": rid, **rec}
                    for rid, rec in history.items()
                ])
            else:
                return _make_contacts_response([
                    {"_record_id": rid, **rec}
                    for rid, rec in contacts.items()
                ])

        return {"ok": False}

    with patch("coach._run_lark", side_effect=run_lark_impl):
        yield


# ── Tests ─────────────────────────────────────────────────────────────

def test_add_contact(mock_lark):
    coach.cmd_add("张三")
    # Verify via get_contact
    rec = coach._get_contact("张三")
    assert rec is not None
    assert rec["name"] == "张三"
    assert rec["tags"] == []
    assert rec["remind_interval_days"] == 7


def test_add_duplicate(mock_lark):
    coach.cmd_add("李四")
    with pytest.raises(SystemExit):
        coach.cmd_add("李四")


def test_tag(mock_lark):
    coach.cmd_add("王五")
    coach.cmd_tag("王五", "朋友", "同事")
    rec = coach._get_contact("王五")
    assert rec["tags"] == ["朋友", "同事"]


def test_goal(mock_lark):
    coach.cmd_add("赵六")
    coach.cmd_goal("赵六", "保持联系", "加深关系")
    rec = coach._get_contact("赵六")
    assert "保持联系 加深关系" in rec["goal"]


def test_note(mock_lark):
    coach.cmd_add("钱七")
    coach.cmd_note("钱七", "喜欢喝咖啡")
    rec = coach._get_contact("钱七")
    assert rec["notes"] == "喜欢喝咖啡"


def test_remind(mock_lark):
    coach.cmd_add("孙八")
    coach.cmd_remind("孙八", "3")
    rec = coach._get_contact("孙八")
    assert rec["remind_interval_days"] == 3


def test_log(mock_lark):
    coach.cmd_add("周九")
    coach.cmd_log("周九", "对方: 你好\\n我: 你好呀")
    rec = coach._get_contact("周九")
    assert rec["last_contact"] == str(date.today())
    hist = coach._get_history(rec["_record_id"])
    assert len(hist) == 2
    assert hist[0]["role"] == "them"
    assert hist[1]["role"] == "me"


def test_log_default_role(mock_lark):
    coach.cmd_add("吴十")
    coach.cmd_log("吴十", "随便说点什么")
    rec = coach._get_contact("吴十")
    hist = coach._get_history(rec["_record_id"])
    assert len(hist) == 1
    assert hist[0]["role"] == "them"


def test_info(mock_lark, capsys):
    coach.cmd_add("小明")
    coach.cmd_info("小明")
    captured = capsys.readouterr().out
    assert "小明" in captured


def test_list_empty(mock_lark, capsys):
    coach.cmd_list()
    captured = capsys.readouterr().out
    assert "暂无联系人" in captured


def test_list_with_contacts(mock_lark, capsys):
    coach.cmd_add("张三")
    coach.cmd_list()
    captured = capsys.readouterr().out
    assert "张三" in captured


def test_history(mock_lark, capsys):
    coach.cmd_add("小红")
    coach.cmd_log("小红", "对方: 在吗\\n我: 在的")
    coach.cmd_history("小红")
    captured = capsys.readouterr().out
    assert "在吗" in captured
    assert "在的" in captured


def test_invalid_command():
    assert "bad_command" not in coach.HANDLERS
