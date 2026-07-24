"""chat-coach Bot 入口：WebSocket 监听飞书消息，自动生成回复建议.

Usage:
    python -m chat_coach.bot
"""

import sys
import time
from threading import Thread

from lark_oapi.event.callback.model.p2_card_action_trigger import (
    P2CardActionTrigger,
    P2CardActionTriggerResponse,
)

from chat_coach.config import get
from chat_coach.event_handler import parse_event
from chat_coach.context import get_history
from chat_coach.writer import add_entry
from chat_coach.reply import handle_message, handle_card_action


class _MessageDedup:
    """基于 message_id 的去重器，防止飞书事件重试导致重复处理.

    飞书事件投递保证 at-least-once，应用层必须自行去重。
    用 dict 存 message_id → 过期时间戳，定期清理过期条目，
    同时限制最大容量防止内存泄漏。
    """

    def __init__(self, ttl: float = 300, max_size: int = 10000):
        self._ttl = ttl
        self._max_size = max_size
        self._seen: dict[str, float] = {}

    def is_duplicate(self, message_id: str) -> bool:
        now = time.monotonic()
        # 每隔一段时间清理过期条目
        if len(self._seen) > self._max_size // 2:
            self._seen = {
                k: v for k, v in self._seen.items() if now - v < self._ttl
            }
        if message_id in self._seen:
            return True
        self._seen[message_id] = now
        # 超过最大容量时丢弃最旧的一半
        if len(self._seen) > self._max_size:
            cutoff = now - self._ttl / 2
            self._seen = {
                k: v for k, v in self._seen.items() if now - v < cutoff
            }
        return False


_dedup = _MessageDedup()


def _process_message(msg_event) -> None:
    """后台处理消息：查历史 → 调 LLM → 发回复 → 写记录."""
    try:
        history = get_history()
        handle_message(msg_event.open_id, msg_event.text, history)
        add_entry("them", msg_event.text)
        print("[bot] 已处理")
    except Exception as e:
        print(f"[bot] 处理失败: {e}")


def _process_card_action(
    open_id: str, message_id: str, token: str,
    action_value: dict, selected_text: str,
) -> None:
    """后台处理卡片按钮点击：发消息 → 更新卡片 → 写记录."""
    try:
        handle_card_action(open_id, message_id, token, action_value)
        if selected_text:
            add_entry("me", selected_text)
        print("[bot] 卡片回调已处理")
    except Exception as e:
        print(f"[bot] 处理卡片回调失败: {e}")


def _make_event_handler():
    """创建 EventDispatcherHandler，注册 im.message.receive_v1 和 card.action.trigger 事件."""
    from lark_oapi.event.dispatcher_handler import EventDispatcherHandler

    def on_im_message(event) -> None:
        # event 是 CustomizedEvent 对象，event.event 为原始事件 dict
        raw = event.event
        if not raw:
            return

        msg_event = parse_event(raw)
        if not msg_event:
            return

        if _dedup.is_duplicate(msg_event.message_id):
            print(f"[bot] 跳过重复消息: {msg_event.message_id}")
            sys.stdout.flush()
            return

        print(f"[bot] 收到消息: {msg_event.text[:50]} (id={msg_event.message_id})")
        sys.stdout.flush()

        # 后台处理，立即返回（避免飞书超时重试）
        Thread(target=_process_message, args=(msg_event,), daemon=True).start()

    def on_card_action(event: P2CardActionTrigger) -> P2CardActionTriggerResponse:
        """处理卡片按钮点击：后台发送选中回复 + 更新卡片，立即返回."""
        try:
            data = event.event
            if not data or not data.action:
                return P2CardActionTriggerResponse({})

            open_id = data.operator.open_id if data.operator else ""
            token = data.token or ""
            action_value = data.action.value or {}
            message_id = (
                data.context.open_message_id if data.context else ""
            )

            if not open_id or not token:
                print(
                    f"[bot] 卡片回调缺少必要字段: "
                    f"open_id={open_id}, token={bool(token)}",
                    flush=True,
                )
                return P2CardActionTriggerResponse({})

            selected_text = action_value.get("t", "")
            print(
                f"[bot] 卡片按钮点击: tag={data.action.tag}, "
                f"open_id={open_id}, text={selected_text[:20]}",
                flush=True,
            )
            sys.stdout.flush()

            # 后台处理，立即返回（避免飞书回调 3 秒超时）
            Thread(
                target=_process_card_action,
                args=(open_id, message_id, token, action_value, selected_text),
                daemon=True,
            ).start()

            return P2CardActionTriggerResponse({})
        except Exception as e:
            print(f"[bot] 处理卡片回调失败: {e}", flush=True)
            return P2CardActionTriggerResponse({})

    return (
        EventDispatcherHandler.builder("", "")
        .register_p2_customized_event("im.message.receive_v1", on_im_message)
        .register_p2_card_action_trigger(on_card_action)
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
