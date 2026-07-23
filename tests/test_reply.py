"""Tests for reply generation and card message building."""

import json
from unittest.mock import MagicMock, patch

from chat_coach.reply import _build_card, _send_bot_message


def test_build_card_structure():
    card = _build_card("test content")
    assert card["config"] == {"wide_screen_mode": True}
    assert card["header"]["title"]["tag"] == "plain_text"
    assert card["header"]["title"]["content"] == "回复建议"
    assert card["header"]["template"] == "blue"


def test_build_card_contains_text():
    text = "1. first\n2. second"
    card = _build_card(text)
    assert card["elements"][0]["tag"] == "markdown"
    assert card["elements"][0]["content"] == text


def test_build_card_has_hr_and_note():
    card = _build_card("test")
    tags = [e["tag"] for e in card["elements"]]
    assert "hr" in tags
    assert "note" in tags


def test_send_bot_message_uses_interactive_msg_type():
    with patch("chat_coach.reply._get_lark_client") as mock_client:
        mock_response = MagicMock()
        mock_response.success.return_value = True
        mock_client.return_value.im.v1.message.create.return_value = mock_response

        _send_bot_message("ou_test", "hello")

        call_args = mock_client.return_value.im.v1.message.create.call_args
        request = call_args[0][0]
        assert request.request_body.msg_type == "interactive"

        card = json.loads(request.request_body.content)
        assert card["header"]["title"]["content"] == "回复建议"
        assert card["elements"][0]["tag"] == "markdown"
        assert card["elements"][0]["content"] == "hello"


def test_send_bot_message_handles_failure():
    with (
        patch("chat_coach.reply._get_lark_client") as mock_client,
        patch("builtins.print") as mock_print,
    ):
        mock_response = MagicMock()
        mock_response.success.return_value = False
        mock_response.msg = "permission denied"
        mock_client.return_value.im.v1.message.create.return_value = mock_response

        _send_bot_message("ou_test", "hello")

        mock_print.assert_any_call(
            "[reply] 发送消息失败: permission denied", flush=True
        )
