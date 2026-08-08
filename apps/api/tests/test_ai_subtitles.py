from datetime import UTC, datetime
from pathlib import Path
from zipfile import ZipFile

from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from fileflow_api.accounts.models import Account, AccountPlan
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


def test_docx_export_contains_editable_subtitle_text(tmp_path: Path) -> None:
    output = tmp_path / "subtitles.docx"
    output.write_bytes(subtitle_docx("Podcast", "First point\nSecond point"))
    with ZipFile(output) as archive:
        document = archive.read("word/document.xml").decode()
    assert "Podcast" in document
    assert "First point" in document
    assert "Second point" in document
