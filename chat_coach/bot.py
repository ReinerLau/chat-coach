"""chat-coach Bot 入口：WebSocket 监听飞书消息，自动生成回复建议.

Usage:
    python -m chat_coach.bot
"""

import sys

from chat_coach.config import get
from chat_coach.event_handler import parse_event
from chat_coach.context import get_history
from chat_coach.writer import add_entry
from chat_coach.reply import handle_message


def _make_event_handler():
    """创建 EventDispatcherHandler，注册 im.message.receive_v1 事件."""
    from lark_oapi.event.dispatcher_handler import EventDispatcherHandler

    def on_im_message(event) -> None:
        # event 是 CustomizedEvent 对象，event.event 为原始事件 dict
        raw = event.event
        if not raw:
            return

        msg_event = parse_event(raw)
        if not msg_event:
            return

        print(f"[bot] 收到消息: {msg_event.text[:50]}")
        sys.stdout.flush()

        history = get_history()
        handle_message(msg_event.open_id, msg_event.text, history)

        add_entry("them", msg_event.text)
        print(f"[bot] 已处理")

    return (
        EventDispatcherHandler.builder("", "")
        .register_p2_customized_event("im.message.receive_v1", on_im_message)
        .build()
    )


def main() -> None:
    app_id = get("lark_app_id")
    app_secret = get("lark_app_secret")

    if not app_id or not app_secret:
        print("错误: 请先在 data/config.json 中配置 lark_app_id 和 lark_app_secret")
        sys.exit(1)

    try:
        from lark_oapi.ws import Client
    except ImportError:
        print("错误: 请先安装 lark-oapi: pip install lark-oapi")
        sys.exit(1)

    print(f"[bot] 启动中 (App ID: {app_id[:8]}...)")
    client = Client(
        app_id=app_id,
        app_secret=app_secret,
        event_handler=_make_event_handler(),
    )
    client.start()


if __name__ == "__main__":
    main()
