"""解析飞书 WebSocket 推送的消息事件."""

import json
from dataclasses import dataclass


@dataclass
class MessageEvent:
    open_id: str
    chat_id: str
    chat_type: str  # "p2p" or "group"
    msg_type: str
    text: str
    message_id: str


def parse_event(event_data: dict) -> MessageEvent | None:
    """从 im.message.receive_v1 事件中提取关键字段.

    兼容两种格式:
    - v2: {"header": {...}, "event": {"message": {...}, "sender": {...}}}
    - v1: {"event_type": ..., "msg_type": ..., "content": ..., "sender": ...}
    """
    # v2 格式: 从 event 字段提取 message 和 sender
    if "event" in event_data and "header" in event_data:
        inner = event_data["event"]
        msg = inner.get("message") or inner
        sender = inner.get("sender") or inner
    else:
        # v1 格式
        msg = event_data.get("message") or event_data
        sender = event_data.get("sender") or event_data

    msg_type = msg.get("msg_type") or msg.get("message_type", "")

    if msg_type != "text":
        return None

    content_str = msg.get("content", "{}")
    try:
        content = json.loads(content_str)
        text = content.get("text", "")
    except (json.JSONDecodeError, TypeError):
        text = ""

    if not text.strip():
        return None

    sender_id = sender.get("sender_id") or sender
    open_id = sender_id.get("open_id", "")

    return MessageEvent(
        open_id=open_id,
        chat_id=msg.get("chat_id", ""),
        chat_type=msg.get("chat_type", ""),
        msg_type=msg_type,
        text=text.strip(),
        message_id=msg.get("message_id", ""),
    )
