"""LLM Provider 抽象基类."""

from abc import ABC, abstractmethod


class LLMProvider(ABC):
    @abstractmethod
    def chat(self, messages: list[dict], **kwargs) -> str:
        """发送消息列表，返回生成的文本."""
        ...


def get_provider(config: dict) -> LLMProvider:
    from chat_coach.llm.openai import OpenAIProvider

    provider = config.get("llm_provider", "openai")

    if provider in ("openai", "deepseek"):
        return OpenAIProvider(
            api_key=config["llm_api_key"],
            model=config.get("llm_model", "deepseek-v4-flash"),
            base_url=config.get("llm_base_url", "https://api.deepseek.com/v1"),
        )
    raise ValueError(f"不支持的 LLM provider: {provider}")
