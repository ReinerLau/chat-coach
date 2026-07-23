"""Tests for event handler parsing and message deduplication."""

import json

from chat_coach.event_handler import parse_event
from chat_coach.bot import _MessageDedup


def test_parse_v2_text_event():
    event = {
        "header": {"event_type": "im.message.receive_v1"},
        "event": {
            "message": {
                "message_id": "om_test",
                "msg_type": "text",
                "content": json.dumps({"text": "周末有空吗"}),
                "chat_id": "oc_test",
                "chat_type": "p2p",
            },
            "sender": {
                "sender_id": {"open_id": "ou_test"},
            },
        },
    }
    result = parse_event(event)
    assert result is not None
    assert result.open_id == "ou_test"
    assert result.text == "周末有空吗"
    assert result.msg_type == "text"
    assert result.chat_type == "p2p"


def test_parse_v1_text_event():
    event = {
        "event_type": "im.message.receive_v1",
        "msg_type": "text",
        "content": json.dumps({"text": "在吗"}),
        "chat_id": "oc_test",
        "chat_type": "p2p",
        "message_id": "om_test",
        "sender": {
            "sender_id": {"open_id": "ou_test"},
        },
    }
    result = parse_event(event)
    assert result is not None
    assert result.open_id == "ou_test"
    assert result.text == "在吗"


def test_parse_non_text_event():
    event = {
        "header": {"event_type": "im.message.receive_v1"},
        "event": {
            "message": {
                "message_id": "om_test",
                "msg_type": "image",
                "content": json.dumps({"image_key": "xxx"}),
            },
            "sender": {
                "sender_id": {"open_id": "ou_test"},
            },
        },
    }
    result = parse_event(event)
    assert result is None


def test_parse_empty_text_event():
    event = {
        "header": {"event_type": "im.message.receive_v1"},
        "event": {
            "message": {
                "message_id": "om_test",
                "msg_type": "text",
                "content": json.dumps({"text": "   "}),
            },
            "sender": {
                "sender_id": {"open_id": "ou_test"},
            },
        },
    }
    result = parse_event(event)
    assert result is None


# ── MessageDedup tests ──────────────────────────────────────────────


def test_dedup_first_message_not_duplicate():
    dedup = _MessageDedup()
    assert not dedup.is_duplicate("om_001")


def test_dedup_repeated_message_is_duplicate():
    dedup = _MessageDedup()
    assert not dedup.is_duplicate("om_001")
    assert dedup.is_duplicate("om_001")
    assert dedup.is_duplicate("om_001")


def test_dedup_different_messages_not_duplicate():
    dedup = _MessageDedup()
    assert not dedup.is_duplicate("om_001")
    assert not dedup.is_duplicate("om_002")
    assert not dedup.is_duplicate("om_003")


def test_dedup_cleanup_does_not_break():
    dedup = _MessageDedup(ttl=0.001, max_size=3)
    # 填满触发清理
    for i in range(5):
        dedup.is_duplicate(f"om_{i:03d}")
    # 新 message_id 不应被误判为重复，清理逻辑不应崩溃
    assert not dedup.is_duplicate("om_999")
