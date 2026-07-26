"""Tests for reply generation, suggestion parsing, and card building."""

import json
import re
from unittest.mock import MagicMock, patch

from chat_coach.reply import (
    _parse_suggestions,
    _build_suggestions_card,
    _build_selected_card,
    _send_bot_message,
    _get_cached_suggestions,
    _cache_suggestions,
    handle_card_action,
)


# ── _parse_suggestions ──────────────────────────────────────────


def test_parse_json_format():
    raw = '{"suggestions":[{"style":"随意","text":"行啊"},{"style":"正式","text":"好的"}]}'
    result = _parse_suggestions(raw)
    assert len(result) == 2
    assert result[0] == {"style": "随意", "text": "行啊"}
    assert result[1] == {"style": "正式", "text": "好的"}


def test_parse_json_in_code_block():
    raw = """```json
{"suggestions":[{"style":"随意","text":"周末可以啊"}]}
```"""
    result = _parse_suggestions(raw)
    assert len(result) == 1
    assert result[0]["text"] == "周末可以啊"


def test_parse_json_without_code_block_lang():
    raw = """```
{"suggestions":[{"style":"","text":"hello"}]}
```"""
    result = _parse_suggestions(raw)
    assert len(result) == 1
    assert result[0]["text"] == "hello"


def test_parse_fallback_line_format():
    raw = "[随意] 周末可以啊 去哪吃\n[正式] 周六有空 你定个时间？"
    result = _parse_suggestions(raw)
    assert len(result) == 2
    assert result[0] == {"style": "随意", "text": "周末可以啊 去哪吃"}
    assert result[1] == {"style": "正式", "text": "周六有空 你定个时间？"}


def test_parse_plain_text_fallback():
    raw = "周末可以啊\n行\n好"
    result = _parse_suggestions(raw)
    assert len(result) == 3
    assert result[0]["style"] == ""
    assert result[0]["text"] == "周末可以啊"


def test_parse_empty():
    assert _parse_suggestions("") == []


def test_parse_skip_text_in_code_block():
    """JSON 代码块提取的优先级 > fallback 行解析."""
    raw = '```json\n{"suggestions":[{"style":"","text":"好的"}]}\n```\n[随意] 这句应该被忽略'
    result = _parse_suggestions(raw)
    # 代码块内 JSON 优先，不会走到 fallback
    assert len(result) >= 1
    assert result[0]["text"] == "好的"


# ── _build_suggestions_card ────────────────────────────────────


def test_suggestions_card_structure():
    suggestions = [
        {"style": "随意", "text": "行啊"},
        {"style": "正式", "text": "好的收到"},
    ]
    card = _build_suggestions_card(suggestions)
    assert card["config"] == {"wide_screen_mode": True}
    assert card["header"]["title"]["content"] == "回复建议"
    assert card["header"]["template"] == "blue"


def test_suggestions_card_has_buttons():
    suggestions = [{"style": "随意", "text": "行啊"}]
    card = _build_suggestions_card(suggestions)

    # 找到 action 元素
    action_elem = None
    for e in card["elements"]:
        if e["tag"] == "action":
            action_elem = e
            break
    assert action_elem is not None
    assert len(action_elem["actions"]) == 1
    btn = action_elem["actions"][0]
    assert btn["tag"] == "button"
    assert btn["text"]["tag"] == "plain_text"
    assert btn["text"]["content"] == "行啊"
    assert btn["value"] == {"i": 0, "t": "行啊"}


def test_suggestions_card_first_button_is_primary():
    suggestions = [
        {"style": "随意", "text": "a"},
        {"style": "正式", "text": "b"},
    ]
    card = _build_suggestions_card(suggestions)
    action_elem = [e for e in card["elements"] if e["tag"] == "action"][0]
    assert action_elem["actions"][0]["type"] == "primary"
    assert action_elem["actions"][1]["type"] == "default"


def test_suggestions_card_truncates_long_text():
    long_text = "这是一个很长很长很长很长很长很长很长很长很长很长很长很长的回复建议文本用于测试按钮文字截断功能" * 3
    assert len(long_text) > 60  # 确保触发截断
    suggestions = [{"style": "", "text": long_text}]
    card = _build_suggestions_card(suggestions)
    action_elem = [e for e in card["elements"] if e["tag"] == "action"][0]
    display = action_elem["actions"][0]["text"]["content"]
    assert len(display) <= 60
    assert display.endswith("...")


def test_suggestions_card_has_note():
    suggestions = [{"style": "", "text": "test"}]
    card = _build_suggestions_card(suggestions)
    tags = [e["tag"] for e in card["elements"]]
    assert "note" in tags


# ── _build_selected_card ───────────────────────────────────────


def test_selected_card_keeps_same_structure():
    """选中后的卡片结构和原卡片一致（标题、文本、布局不变）."""
    suggestions = [
        {"style": "随意", "text": "选这个"},
        {"style": "正式", "text": "不选这个"},
    ]
    card = _build_selected_card(suggestions, 0, "ou_test")

    # 标题不变
    assert card["header"]["title"]["content"] == "回复建议"
    assert card["header"]["template"] == "blue"

    # 保留 markdown + action + note 结构
    tags = [e["tag"] for e in card["elements"]]
    assert "markdown" in tags
    assert "action" in tags
    assert "note" in tags

    # markdown 内容不变（无删除线、无 ✅）
    md = card["elements"][0]["content"]
    assert "✅" not in md
    assert "~~" not in md
    assert "选这个" in md
    assert "不选这个" in md


def test_selected_card_disables_all_buttons():
    """未选中按钮被禁用，选中按钮不禁用."""
    suggestions = [
        {"style": "随意", "text": "选这个"},
        {"style": "正式", "text": "不选"},
    ]
    card = _build_selected_card(suggestions, 0, "ou_test")

    action_elem = [e for e in card["elements"] if e["tag"] == "action"][0]
    # 未选中按钮 disabled
    assert action_elem["actions"][1].get("disabled") is True
    # 选中按钮不禁用
    assert "disabled" not in action_elem["actions"][0]


def test_selected_card_selected_button_has_checkmark():
    """选中按钮文字加 ✓ 前缀，不禁用、无 tooltip."""
    suggestions = [
        {"style": "随意", "text": "选这个"},
        {"style": "正式", "text": "不选"},
    ]
    card = _build_selected_card(suggestions, 0, "ou_test")

    action_elem = [e for e in card["elements"] if e["tag"] == "action"][0]
    # 选中按钮有 ✓ 前缀
    assert action_elem["actions"][0]["text"]["content"].startswith("✓ ")
    # 选中按钮不禁用，无 tooltip
    assert "disabled" not in action_elem["actions"][0]
    assert "disabled_tips" not in action_elem["actions"][0]
    # 未选中按钮无 ✓ 前缀
    assert not action_elem["actions"][1]["text"]["content"].startswith("✓ ")


def test_selected_card_has_open_ids():
    suggestions = [{"style": "", "text": "test"}]
    card = _build_selected_card(suggestions, 0, "ou_123")
    assert card["open_ids"] == ["ou_123"]


def test_selected_card_header_unchanged():
    """选中后标题不变."""
    suggestions = [{"style": "", "text": "test"}]
    card = _build_selected_card(suggestions, 0, "ou_test")
    assert card["header"]["title"]["content"] == "回复建议"


# ── _send_bot_message ─────────────────────────────────────────


def test_send_bot_message_uses_interactive_msg_type():
    with patch("chat_coach.reply._get_lark_client") as mock_client:
        mock_response = MagicMock()
        mock_response.success.return_value = True
        mock_response.data.message_id = "om_test123"
        mock_client.return_value.im.v1.message.create.return_value = mock_response

        msg_id = _send_bot_message("ou_test", '[{"style":"","text":"hello"}]')

        call_args = mock_client.return_value.im.v1.message.create.call_args
        request = call_args[0][0]
        assert request.request_body.msg_type == "interactive"

        card = json.loads(request.request_body.content)
        assert card["header"]["title"]["content"] == "回复建议"
        assert msg_id == "om_test123"


def test_send_bot_message_caches_suggestions():
    with patch("chat_coach.reply._get_lark_client") as mock_client:
        mock_response = MagicMock()
        mock_response.success.return_value = True
        mock_response.data.message_id = "om_cache_test"
        mock_client.return_value.im.v1.message.create.return_value = mock_response

        _send_bot_message(
            "ou_test",
            '{"suggestions":[{"style":"随意","text":"周末可以啊"}]}',
        )

        cached = _get_cached_suggestions("om_cache_test")
        assert cached is not None
        assert cached[0]["text"] == "周末可以啊"


def test_send_bot_message_handles_failure():
    with (
        patch("chat_coach.reply._get_lark_client") as mock_client,
        patch("builtins.print") as mock_print,
    ):
        mock_response = MagicMock()
        mock_response.success.return_value = False
        mock_response.msg = "permission denied"
        mock_client.return_value.im.v1.message.create.return_value = mock_response

        msg_id = _send_bot_message("ou_test", "hello")

        assert msg_id is None
        mock_print.assert_any_call(
            "[reply] 发送消息失败: permission denied", flush=True
        )


def test_send_bot_message_no_valid_suggestions():
    with patch("builtins.print") as mock_print:
        msg_id = _send_bot_message("ou_test", "")
        assert msg_id is None
        mock_print.assert_any_call(
            "[reply] LLM 未返回有效回复建议", flush=True
        )


# ── handle_card_action ─────────────────────────────────────────


def test_handle_card_action_sends_text_and_updates_card():
    with (
        patch("chat_coach.reply._send_text_message") as mock_send,
        patch("chat_coach.reply._update_card_message") as mock_update,
    ):
        suggestions = [
            {"style": "随意", "text": "选这个"},
            {"style": "正式", "text": "不选"},
        ]
        _cache_suggestions("om_test", suggestions)

        handle_card_action(
            "ou_test", "om_test", "token123",
            {"i": 0, "t": "选这个"},
        )

        mock_send.assert_called_once_with("ou_test", "选这个")
        mock_update.assert_called_once()
        # 验证更新卡片包含 open_ids
        updated_card = mock_update.call_args[0][1]
        assert updated_card["open_ids"] == ["ou_test"]


def test_handle_card_action_cache_miss_sends_only():
    """缓存未命中时只发消息，跳过卡片更新."""
    with (
        patch("chat_coach.reply._send_text_message") as mock_send,
        patch("chat_coach.reply._update_card_message") as mock_update,
        patch("builtins.print") as mock_print,
    ):
        handle_card_action(
            "ou_test", "om_nonexistent", "token123",
            {"i": 0, "t": "选这个"},
        )

        mock_send.assert_called_once_with("ou_test", "选这个")
        mock_update.assert_not_called()


def test_handle_card_action_missing_text():
    with (
        patch("chat_coach.reply._send_text_message") as mock_send,
        patch("chat_coach.reply._update_card_message") as mock_update,
        patch("builtins.print") as mock_print,
    ):
        handle_card_action("ou_test", "om_test", "token123", {"i": 0, "t": ""})

        mock_send.assert_not_called()
        mock_update.assert_not_called()


# ── 卡片缓存 ───────────────────────────────────────────────────


def test_cache_expiry():
    import time
    from chat_coach import reply as reply_mod

    suggestions = [{"style": "", "text": "test"}]
    _cache_suggestions("om_expire", suggestions)

    # 模拟过期：把缓存时间戳改到 TTL 之前
    expired_ts = time.monotonic() - reply_mod._CACHE_TTL - 60
    with reply_mod._card_cache_lock:
        reply_mod._card_cache["om_expire"] = (suggestions, expired_ts)

    cached = _get_cached_suggestions("om_expire")
    assert cached is None
