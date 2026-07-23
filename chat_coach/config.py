"""配置管理：优先环境变量 CHAT_COACH_<KEY>，fallback 到 data/config.json."""

import json
import os
from pathlib import Path


def _find_config() -> Path | None:
    """在包目录和主工作区中查找 data/config.json.

    git worktree 中 data/ 目录被 gitignore 排除，只有主工作区才有。
    通过解析 .git 文件自动定位主工作区，避免每次手动链 data/。
    """
    pkg_root = Path(__file__).resolve().parent.parent

    # 1. 当前包目录（主 checkout 直接命中）
    candidate = pkg_root / "data" / "config.json"
    if candidate.exists():
        return candidate

    # 2. 通过 .git 文件解析主工作区路径（worktree 场景）
    git_file = pkg_root / ".git"
    if git_file.is_file():
        gitdir = git_file.read_text().strip()
        # 格式: "gitdir: /path/to/main/.git/worktrees/name"
        if gitdir.startswith("gitdir: "):
            gitdir_path = Path(gitdir[len("gitdir: "):])
            # .git/worktrees/name → 主工作区根目录
            main_root = gitdir_path.resolve().parent.parent.parent
            candidate = main_root / "data" / "config.json"
            if candidate.exists():
                return candidate

    return None


_CONFIG_PATH = _find_config()

_config_cache = None


def _load_config() -> dict:
    global _config_cache
    if _config_cache is not None:
        return _config_cache
    if _CONFIG_PATH and _CONFIG_PATH.exists():
        _config_cache = json.loads(_CONFIG_PATH.read_text())
    else:
        _config_cache = {}
    return _config_cache


def get(key: str, default=None):
    env_key = f"CHAT_COACH_{key.upper()}"
    env_val = os.environ.get(env_key)
    if env_val is not None:
        return env_val
    return _load_config().get(key, default)
