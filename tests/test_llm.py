"""Tests for LLM providers."""

from unittest.mock import MagicMock, patch

import pytest

from chat_coach.llm.base import get_provider
from chat_coach.llm.openai import OpenAIProvider


def test_openai_provider_chat():
    provider = OpenAIProvider(api_key="sk-test", model="deepseek-chat")

    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = "你好"

    with patch.object(provider.client.chat.completions, "create", return_value=mock_response):
        result = provider.chat([{"role": "user", "content": "test"}])
        assert result == "你好"


def test_get_provider_openai():
    config = {
        "llm_provider": "openai",
        "llm_api_key": "sk-test",
        "llm_model": "gpt-4o",
        "llm_base_url": "https://api.openai.com/v1",
    }
    provider = get_provider(config)
    assert isinstance(provider, OpenAIProvider)
    assert provider.model == "gpt-4o"


def test_get_provider_deepseek():
    config = {
        "llm_provider": "deepseek",
        "llm_api_key": "sk-test",
    }
    provider = get_provider(config)
    assert isinstance(provider, OpenAIProvider)
    assert provider.model == "deepseek-v4-flash"


def test_get_provider_unsupported():
    config = {
        "llm_provider": "unknown",
        "llm_api_key": "sk-test",
    }
    with pytest.raises(ValueError, match="不支持的 LLM provider"):
        get_provider(config)
