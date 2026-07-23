"""配置管理：优先环境变量 CHAT_COACH_<KEY>，fallback 到 data/config.json."""

import json
import os
from pathlib import Path

_CONFIG_PATH = Path(__file__).resolve().parent.parent / "data" / "config.json"

_config_cache = None


def _load_config() -> dict:
    global _config_cache
    if _config_cache is not None:
        return _config_cache
    if _CONFIG_PATH.exists():
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
