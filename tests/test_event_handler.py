"""Tests for event handler parsing."""

import json

from chat_coach.event_handler import parse_event


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
