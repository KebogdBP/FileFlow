import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from zipfile import ZipFile

from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from fileflow_api.accounts.models import Account, AccountPlan
from fileflow_api.ai.client import OpenAiCompatibleClient
from fileflow_api.ai.contracts import SubtitleAssistRequest
from fileflow_api.ai.documents import subtitle_docx
from fileflow_api.ai.service import SubtitleAiService
from fileflow_api.config import Settings
from fileflow_api.database import Base, build_session_factory


class FakeAiClient:
    model = "deepseek-test"

    def __init__(self) -> None:
        self.messages: list[dict[str, str]] = []

    def complete(self, messages: list[dict[str, str]]) -> str:
        self.messages = messages
        return "The speaker discussed safe automation."


class FakeProviderResponse:
    def __enter__(self) -> "FakeProviderResponse":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def read(self) -> bytes:
        return json.dumps({"choices": [{"message": {"content": "Provider OK"}}]}).encode()


def _provider_stub(captured: dict[str, Any]):
    def urlopen(request: Any, timeout: float) -> FakeProviderResponse:
        captured["url"] = request.full_url
        captured["payload"] = json.loads(request.data)
        captured["authorization"] = request.headers["Authorization"]
        captured["timeout"] = timeout
        return FakeProviderResponse()

    return urlopen


def test_gemini_uses_openai_compatible_endpoint_without_deepseek_thinking(
    monkeypatch: Any,
) -> None:
    captured: dict[str, Any] = {}
    monkeypatch.setattr("fileflow_api.ai.client.urlopen", _provider_stub(captured))
    client = OpenAiCompatibleClient(
        Settings(
            environment="test",
            ai_provider="gemini",
            gemini_api_key="gemini-test-key",
        )
    )

    assert client.complete([{"role": "user", "content": "Hello"}]) == "Provider OK"
    assert captured["url"].endswith("/v1beta/openai/chat/completions")
    assert captured["payload"]["model"] == "gemini-3.6-flash"
    assert "thinking" not in captured["payload"]
    assert captured["payload"]["reasoning_effort"] == "low"
    assert captured["authorization"] == "Bearer gemini-test-key"


def test_deepseek_keeps_thinking_disabled(monkeypatch: Any) -> None:
    captured: dict[str, Any] = {}
    monkeypatch.setattr("fileflow_api.ai.client.urlopen", _provider_stub(captured))
    client = OpenAiCompatibleClient(
        Settings(
            environment="test",
            ai_provider="deepseek",
            deepseek_api_key="deepseek-test-key",
        )
    )

    assert client.complete([{"role": "user", "content": "Hello"}]) == "Provider OK"
    assert captured["payload"]["thinking"] == {"type": "disabled"}


def test_ai_assistant_grounds_the_question_in_subtitle_text() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    sessions = build_session_factory(engine)
    with sessions.begin() as session:
        session.add(
            Account(
                id="a" * 32,
                email="ai@example.com",
                display_name="AI User",
                password_hash="unused",
                plan=AccountPlan.FREE,
                created_at=datetime.now(UTC),
            )
        )
    client = FakeAiClient()
    service = SubtitleAiService(sessions, client, Settings(environment="test"))
    result = service.assist(
        "a" * 32,
        SubtitleAssistRequest(
            source_text="00:01 The speaker discussed safe automation.",
            prompt="What was the topic?",
        ),
    )
    assert result.answer == "The speaker discussed safe automation."
    assert result.remaining_today == 19
    assert "SUBTITLE TEXT START" in client.messages[1]["content"]
    assert client.messages[-1]["content"] == "What was the topic?"


def test_ai_assistant_uses_public_response_analysis_for_comments() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    sessions = build_session_factory(engine)
    with sessions.begin() as session:
        session.add(
            Account(
                id="b" * 32,
                email="comments@example.com",
                display_name="Comments User",
                password_hash="unused",
                plan=AccountPlan.FREE,
                created_at=datetime.now(UTC),
            )
        )
    client = FakeAiClient()
    service = SubtitleAiService(sessions, client, Settings(environment="test"))
    service.assist(
        "b" * 32,
        SubtitleAssistRequest(
            source_text="COMMENT 1\nAuthor: Viewer\nI support this idea.",
            source_kind="comments",
            prompt="What is the public response?",
        ),
    )
    assert "public-response analyst" in client.messages[0]["content"]
    assert "PUBLIC COMMENTS START" in client.messages[1]["content"]


def test_docx_export_contains_editable_subtitle_text(tmp_path: Path) -> None:
    output = tmp_path / "subtitles.docx"
    output.write_bytes(subtitle_docx("Podcast", "First point\nSecond point"))
    with ZipFile(output) as archive:
        document = archive.read("word/document.xml").decode()
    assert "Podcast" in document
    assert "First point" in document
    assert "Second point" in document
