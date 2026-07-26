"""回复生成和发送."""

import json
import re
import time
from pathlib import Path
from threading import Lock

from chat_coach.llm import get_provider
from chat_coach.config import get as _cfg

_PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "reply.md"
_SYSTEM_PROMPT = _PROMPT_PATH.read_text() if _PROMPT_PATH.exists() else ""

# 卡片缓存：message_id → (suggestions, timestamp)
_card_cache: dict[str, tuple[list[dict], float]] = {}
_card_cache_lock = Lock()
_CACHE_TTL = 600  # 10 分钟


def _cache_suggestions(message_id: str, suggestions: list[dict]) -> None:
    """缓存已发送卡片的回复建议列表."""
    now = time.monotonic()
    with _card_cache_lock:
        expired = [k for k, v in _card_cache.items() if now - v[1] > _CACHE_TTL]
        for k in expired:
            del _card_cache[k]
        _card_cache[message_id] = (suggestions, now)


def _get_cached_suggestions(message_id: str) -> list[dict] | None:
    """取出缓存的回复建议，过期返回 None."""
    with _card_cache_lock:
        entry = _card_cache.get(message_id)
        if entry is None:
            return None
        suggestions, ts = entry
        if time.monotonic() - ts <= _CACHE_TTL:
            return suggestions
        del _card_cache[message_id]
    return None


def _get_lark_client():
    """创建飞书 API 客户端."""
    from lark_oapi import Client

    app_id = _cfg("lark_app_id")
    app_secret = _cfg("lark_app_secret")
    return Client.builder().app_id(app_id).app_secret(app_secret).build()


def _parse_suggestions(raw: str) -> list[dict]:
    """解析 LLM 回复为 {style, text} 列表.

    优先 JSON 格式，fallback 到 [风格] 文本 行格式。
    """
    raw = raw.strip()

    # 尝试 JSON
    try:
        data = json.loads(raw)
        if isinstance(data, dict) and "suggestions" in data:
            return [
                {"style": s.get("style", ""), "text": s["text"]}
                for s in data["suggestions"]
                if s.get("text")
            ]
    except (json.JSONDecodeError, KeyError, TypeError):
        pass

    # 尝试从 markdown 代码块中提取 JSON
    m = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", raw, re.DOTALL)
    if m:
        try:
            data = json.loads(m.group(1))
            if isinstance(data, dict) and "suggestions" in data:
                return [
                    {"style": s.get("style", ""), "text": s["text"]}
                    for s in data["suggestions"]
                    if s.get("text")
                ]
        except (json.JSONDecodeError, KeyError, TypeError):
            pass

    # Fallback: [风格] 文本 行格式
    suggestions = []
    for line in raw.split("\n"):
        line = line.strip()
        if not line:
            continue
        m = re.match(r"\[(.+?)\]\s*(.+)", line)
        if m:
            suggestions.append({"style": m.group(1), "text": m.group(2).strip()})
        elif line and not line.startswith("{") and not line.startswith("```"):
            suggestions.append({"style": "", "text": line})

    return suggestions[:10]


def _build_suggestions_card(suggestions: list[dict]) -> dict:
    """构建带按钮的回复建议卡片."""
    buttons = []
    for i, s in enumerate(suggestions):
        text = s["text"]
        display = text if len(text) <= 60 else text[:57] + "..."
        buttons.append(
            {
                "tag": "button",
                "text": {"tag": "plain_text", "content": display},
                "type": "primary" if i == 0 else "default",
                "value": {"i": i, "t": text},
            }
        )

    lines = []
    for i, s in enumerate(suggestions):
        style_tag = f"[{s['style']}] " if s["style"] else ""
        lines.append(f"**{i+1}.** {style_tag}{s['text']}")

    return {
        "config": {"wide_screen_mode": True},
        "header": {
            "title": {"tag": "plain_text", "content": "回复建议"},
            "template": "blue",
        },
        "elements": [
            {"tag": "markdown", "content": "\n".join(lines)},
            {"tag": "hr"},
            {"tag": "action", "actions": buttons},
            {"tag": "hr"},
            {
                "tag": "note",
                "elements": [{"tag": "plain_text", "content": "点击按钮发送对应回复"}],
            },
        ],
    }


def _build_selected_card(
    suggestions: list[dict], selected_index: int, open_id: str
) -> dict:
    """构建选中后的更新卡片（保持原样式，仅禁用按钮）."""
    card = _build_suggestions_card(suggestions)

    # 禁用未选中按钮，选中按钮加 ✓ 标记但不置灰
    for elem in card["elements"]:
        if elem["tag"] == "action":
            for i, btn in enumerate(elem["actions"]):
                if i == selected_index:
                    btn["text"]["content"] = "✓ " + btn["text"]["content"]
                else:
                    btn["disabled"] = True

    # Card 1.0 更新必须包含 open_ids
    card["open_ids"] = [open_id]
    return card


def _send_bot_message(open_id: str, text: str) -> str | None:
    """发送卡片消息，返回 message_id."""
    from lark_oapi.api.im.v1 import CreateMessageRequest, CreateMessageRequestBody

    suggestions = _parse_suggestions(text)
    if not suggestions:
        print("[reply] LLM 未返回有效回复建议", flush=True)
        return None

    card = _build_suggestions_card(suggestions)
    client = _get_lark_client()
    request = (
        CreateMessageRequest.builder()
        .receive_id_type("open_id")
        .request_body(
            CreateMessageRequestBody.builder()
            .receive_id(open_id)
            .msg_type("interactive")
            .content(json.dumps(card, ensure_ascii=False))
            .build()
        )
        .build()
    )
    response = client.im.v1.message.create(request)
    if not response.success():
        print(f"[reply] 发送消息失败: {response.msg}", flush=True)
        return None

    message_id = response.data.message_id
    if message_id:
        _cache_suggestions(message_id, suggestions)
    return message_id


def _send_text_message(open_id: str, text: str) -> None:
    """发送纯文本消息."""
    from lark_oapi.api.im.v1 import CreateMessageRequest, CreateMessageRequestBody

    client = _get_lark_client()
    content = json.dumps({"text": text}, ensure_ascii=False)
    request = (
        CreateMessageRequest.builder()
        .receive_id_type("open_id")
        .request_body(
            CreateMessageRequestBody.builder()
            .receive_id(open_id)
            .msg_type("text")
            .content(content)
            .build()
        )
        .build()
    )
    response = client.im.v1.message.create(request)
    if not response.success():
        print(f"[reply] 发送文本消息失败: {response.msg}", flush=True)


def _update_card_message(token: str, card: dict) -> bool:
    """通过 lark_oapi SDK 调用卡片更新 API."""
    from lark_oapi.core import HttpMethod, AccessTokenType
    from lark_oapi.core.model.base_request import BaseRequest

    client = _get_lark_client()
    request = (
        BaseRequest.builder()
        .http_method(HttpMethod.POST)
        .uri("/open-apis/interactive/v1/card/update")
        .token_types({AccessTokenType.TENANT})
        .body({"token": token, "card": card})
        .build()
    )
    response = client.request(request)
    if response.code != 0:
        print(
            f"[reply] 更新卡片失败: {response.msg} (code={response.code})",
            flush=True,
        )
        return False
    return True


# ── 公开 API ──────────────────────────────────────────────────


def handle_card_action(
    open_id: str, message_id: str, token: str, action_value: dict
) -> None:
    """处理卡片按钮点击：发送选中回复 + 更新卡片."""
    selected_index = action_value.get("i", 0)
    selected_text = action_value.get("t", "")

    if not selected_text:
        print("[reply] 卡片回调缺少回复文本", flush=True)
        return

    suggestions = _get_cached_suggestions(message_id)

    # 发送选中文本
    _send_text_message(open_id, selected_text)

    # 更新卡片（若缓存命中）
    if suggestions is not None:
        updated_card = _build_selected_card(suggestions, selected_index, open_id)
        _update_card_message(token, updated_card)
    else:
        print(f"[reply] 缓存未命中 message_id={message_id}，跳过卡片更新", flush=True)


def build_messages(history: list[dict], new_message: str) -> list[dict]:
    """拼接 LLM 请求的 messages 列表."""
    messages = [{"role": "system", "content": _SYSTEM_PROMPT}]

    history_text = ""
    for entry in history:
        label = "对方" if entry["role"] == "them" else "我"
        history_text += f"{label}: {entry['content']}\n"

    if history_text:
        messages.append(
            {
                "role": "user",
                "content": (
                    f"聊天历史：\n\n{history_text}\n\n"
                    f"对方最新消息：{new_message}\n\n请生成 2-3 条回复建议。"
                ),
            }
        )
    else:
        messages.append(
            {
                "role": "user",
                "content": f"对方消息：{new_message}\n\n请生成 2-3 条回复建议。",
            }
        )

    return messages


def generate_reply(history: list[dict], new_message: str) -> str:
    """调用 LLM 生成回复建议."""
    llm_config = {
        "llm_provider": _cfg("llm_provider", "openai"),
        "llm_api_key": _cfg("llm_api_key"),
        "llm_model": _cfg("llm_model", "deepseek-v4-flash"),
        "llm_base_url": _cfg("llm_base_url", "https://api.deepseek.com/v1"),
    }

    if not llm_config["llm_api_key"]:
        return '{"suggestions":[{"style":"","text":"未配置 LLM API Key"}]}'

    provider = get_provider(llm_config)
    messages = build_messages(history, new_message)
    return provider.chat(messages, response_format={"type": "json_object"})


def handle_message(open_id: str, text: str, history: list[dict]) -> None:
    """处理一条消息：生成回复并发送卡片."""
    reply = generate_reply(history, text)
    _send_bot_message(open_id, reply)
