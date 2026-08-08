import json
from typing import Protocol
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fileflow_api.config import Settings


class AiProviderError(RuntimeError):
    pass


class AiClient(Protocol):
    @property
    def model(self) -> str: ...

    def complete(self, messages: list[dict[str, str]]) -> str: ...


class OpenAiCompatibleClient:
    def __init__(self, settings: Settings) -> None:
        self._provider = settings.ai_provider
        if self._provider == "gemini":
            self._api_key = (
                settings.gemini_api_key.get_secret_value() if settings.gemini_api_key else None
            )
            self._base_url = str(settings.gemini_base_url).rstrip("/")
            self._model = settings.gemini_model
            self._timeout = settings.gemini_timeout_seconds
        else:
            self._api_key = (
                settings.deepseek_api_key.get_secret_value() if settings.deepseek_api_key else None
            )
            self._base_url = str(settings.deepseek_base_url).rstrip("/")
            self._model = settings.deepseek_model
            self._timeout = settings.deepseek_timeout_seconds

    @property
    def model(self) -> str:
        return self._model

    def complete(self, messages: list[dict[str, str]]) -> str:
        if not self._api_key:
            raise AiProviderError("ai_not_configured")
        request_payload: dict[str, object] = {
            "model": self._model,
            "messages": messages,
            "max_tokens": 4_000,
        }
        if self._provider == "deepseek":
            request_payload["thinking"] = {"type": "disabled"}
        else:
            request_payload["reasoning_effort"] = "low"
        body = json.dumps(request_payload).encode()
        request = Request(
            f"{self._base_url}/chat/completions",
            data=body,
            method="POST",
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        )
        try:
            with urlopen(request, timeout=self._timeout) as response:
                response_payload = json.loads(response.read())
        except HTTPError as error:
            if error.code == 429:
                raise AiProviderError("ai_rate_limited") from error
            raise AiProviderError("ai_provider_failed") from error
        except (URLError, TimeoutError, json.JSONDecodeError) as error:
            raise AiProviderError("ai_provider_unavailable") from error
        try:
            answer = response_payload["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError, AttributeError) as error:
            raise AiProviderError("ai_invalid_response") from error
        if not answer:
            raise AiProviderError("ai_empty_response")
        return str(answer)
