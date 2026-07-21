"""Tests for coach.py with mocked lark-cli calls."""

import json
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import coach

# Ensure module-level constants are set even when config.json is absent (CI).
coach.HISTORY_TABLE = coach.HISTORY_TABLE or "test_history_table"


# ── Helpers for building fake Bitable API responses ───────────────────

def _make_history_response(records: list[dict]) -> dict:
    """Build a +record-list response for the history table."""
    fields = ["Content", "Role"]
    data_rows = []
    record_ids = []
    for rec in records:
        record_ids.append(rec.pop("_record_id"))
        data_rows.append([
            rec.get("Content", ""),
            rec.get("Role", ""),
        ])
    return {
        "ok": True,
        "data": {
            "data": data_rows,
            "fields": fields,
            "field_id_list": ["fldXbZ9K6l", "fldPx4NWmO"],
            "record_id_list": record_ids,
            "has_more": False,
        },
    }


# ── Fixture: stateful mock of _run_lark ───────────────────────────────

@pytest.fixture
def mock_lark():
    """Replace coach._run_lark with a stateful in-memory history store."""
    history = {}   # record_id -> record dict
    _next_id = 0

    def next_id():
        nonlocal _next_id
        _next_id += 1
        return f"rec_test_{_next_id:03d}"

    def _parse_payload(args):
        """Extract JSON payload from args."""
        for i, a in enumerate(args):
            if a is None:
                continue
            if a.startswith("--json="):
                return json.loads(a.split("=", 1)[1])
            if a == "--json" and i + 1 < len(args):
                val = args[i + 1]
                if val is not None:
                    return json.loads(val)
        return None

    def run_lark_impl(args: list[str]) -> dict:
        cmd = args[0] if args else None

        if cmd == "+record-upsert":
            payload = _parse_payload(args) or {}
            rid = next_id()
            history[rid] = dict(payload)
            return {"ok": True, "data": {"created": True, "record": {"record_id_list": [rid]}}}

        elif cmd == "+record-list":
            return _make_history_response([
                {"_record_id": rid, **rec}
                for rid, rec in history.items()
            ])

        return {"ok": False}

    with patch("coach._run_lark", side_effect=run_lark_impl):
        yield


# ── Helpers for seeding data ──────────────────────────────────────────

def _add_history_entry(role: str, content: str) -> None:
    """Add a history record via _run_lark upsert."""
    coach._run_lark([
        "+record-upsert",
        "--base-token", "test_base_token",
        "--table-id", coach.HISTORY_TABLE,
        "--json", json.dumps({
            "Role": "对方" if role == "them" else "我",
            "Content": content,
        }, ensure_ascii=False),
    ])


# ── Tests ─────────────────────────────────────────────────────────────

def test_context_empty(mock_lark, capsys):
    coach.cmd_context()
    captured = capsys.readouterr().out
    assert "暂无聊天记录" in captured


def test_context_with_history(mock_lark, capsys):
    _add_history_entry("them", "你好")
    _add_history_entry("me", "你好呀")

    coach.cmd_context()
    captured = capsys.readouterr().out
    assert "对方: 你好" in captured
    assert "我: 你好呀" in captured


def test_invalid_command():
    assert "bad_command" not in coach.HANDLERS
    assert "context" in coach.HANDLERS
    assert len(coach.HANDLERS) == 1
