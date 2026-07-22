"""OpenAI 兼容接口（DeepSeek / Qwen / 豆包 等）."""

from openai import OpenAI

from chat_coach.llm.base import LLMProvider


class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str, model: str = "deepseek-chat", base_url: str = "https://api.deepseek.com/v1"):
        self.model = model
        self.client = OpenAI(api_key=api_key, base_url=base_url)

    def chat(self, messages: list[dict], **kwargs) -> str:
        response = self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            temperature=kwargs.get("temperature", 0.9),
            max_tokens=kwargs.get("max_tokens", 300),
        )
        return response.choices[0].message.content or ""
