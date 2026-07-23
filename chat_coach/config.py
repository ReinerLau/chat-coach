"""配置管理：优先级 env > data/config.local.json > data/config.json.

- config.json：模板，git 跟踪，字段为空占位
- config.local.json：本地真实值，gitignore 保护，不提交
"""

import json
import os
from pathlib import Path

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_LOCAL_CONFIG = _DATA_DIR / "config.local.json"
_TEMPLATE_CONFIG = _DATA_DIR / "config.json"

_config_cache = None


def _load_config() -> dict:
    global _config_cache
    if _config_cache is not None:
        return _config_cache

    merged = {}
    # 先读模板（提供默认结构和字段）
    if _TEMPLATE_CONFIG.exists():
        merged.update(json.loads(_TEMPLATE_CONFIG.read_text()))
    # 再用本地值覆盖
    if _LOCAL_CONFIG.exists():
        merged.update(json.loads(_LOCAL_CONFIG.read_text()))

    _config_cache = merged
    return _config_cache


def get(key: str, default=None):
    env_key = f"CHAT_COACH_{key.upper()}"
    env_val = os.environ.get(env_key)
    if env_val is not None:
        return env_val
    return _load_config().get(key, default)
