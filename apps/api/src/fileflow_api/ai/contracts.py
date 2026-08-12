from typing import Literal

from pydantic import BaseModel, Field, field_validator


class AiMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8_000)

    @field_validator("content")
    @classmethod
    def clean_content(cls, value: str) -> str:
        return value.strip()


class SubtitleAssistRequest(BaseModel):
    source_text: str = Field(min_length=1)
    source_kind: Literal["subtitles", "comments"] = "subtitles"
    prompt: str = Field(min_length=1, max_length=4_000)
    history: list[AiMessage] = Field(default_factory=list, max_length=8)
    response_language: str = Field(default="auto", max_length=32)

    @field_validator("source_text", "prompt")
    @classmethod
    def clean_text(cls, value: str) -> str:
        return value.strip()


class SubtitleAssistResponse(BaseModel):
    answer: str
    model: str
    remaining_today: int


class SubtitleDocumentRequest(BaseModel):
    title: str = Field(default="FileFlow subtitles", min_length=1, max_length=200)
    text: str = Field(min_length=1, max_length=400_000)
