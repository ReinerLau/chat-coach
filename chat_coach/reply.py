"""回复生成和发送."""

import json
from pathlib import Path

from chat_coach.llm import get_provider
from chat_coach.config import get as _cfg

_PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "reply.md"
_SYSTEM_PROMPT = _PROMPT_PATH.read_text() if _PROMPT_PATH.exists() else ""


def _get_lark_client():
    """创建飞书 API 客户端."""
    from lark_oapi import Client

    app_id = _cfg("lark_app_id")
    app_secret = _cfg("lark_app_secret")
    return Client.builder().app_id(app_id).app_secret(app_secret).build()


def _build_card(text: str) -> dict:
    """将回复文本包装为飞书卡片 JSON."""
    return {
        "config": {"wide_screen_mode": True},
        "header": {
            "title": {"tag": "plain_text", "content": "回复建议"},
            "template": "blue",
        },
        "elements": [
            {"tag": "markdown", "content": text},
            {"tag": "hr"},
            {
                "tag": "note",
                "elements": [{"tag": "plain_text", "content": "Chat Coach"}],
            },
        ],
    }


def _send_bot_message(open_id: str, text: str) -> None:
    """通过飞书 SDK 以 bot 身份发送卡片消息."""
    from lark_oapi.api.im.v1 import CreateMessageRequest, CreateMessageRequestBody

    card = _build_card(text)
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


def build_messages(history: list[dict], new_message: str) -> list[dict]:
    """拼接 LLM 请求的 messages 列表."""
    messages = [{"role": "system", "content": _SYSTEM_PROMPT}]

    history_text = ""
    for entry in history:
        label = "对方" if entry["role"] == "them" else "我"
        history_text += f"{label}: {entry['content']}\n"

    if history_text:
        messages.append({
            "role": "user",
            "content": f"聊天历史：\n\n{history_text}\n\n对方最新消息：{new_message}\n\n请生成 2-3 条回复建议。",
        })
    else:
        messages.append({
            "role": "user",
            "content": f"对方消息：{new_message}\n\n请生成 2-3 条回复建议。",
        })

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
        return "[错误] 未配置 LLM API Key，请在 data/config.json 中设置 llm_api_key"

    provider = get_provider(llm_config)
    messages = build_messages(history, new_message)
    return provider.chat(messages)


def handle_message(open_id: str, text: str, history: list[dict]) -> None:
    """处理一条消息：生成回复并发送."""
    reply = generate_reply(history, text)
    _send_bot_message(open_id, reply)
