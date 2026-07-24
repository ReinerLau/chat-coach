"""开发模式：文件变更自动重启 bot.

Usage:
    chat-coach-dev
    python -m chat_coach.dev
"""

import sys
from pathlib import Path


def main() -> None:
    from watchfiles import run_process

    project_root = Path(__file__).resolve().parent.parent
    watch_dirs = [
        project_root / "chat_coach",
        project_root / "prompts",
    ]

    run_process(
        *[str(d) for d in watch_dirs],
        target=[sys.executable, "-m", "chat_coach.bot"],
        callback=lambda changes: print(
            f"[dev] {len(changes)} 个文件变更，重启中..."
        ),
    )
