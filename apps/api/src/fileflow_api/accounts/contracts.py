from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from fileflow_api.accounts.models import AccountPlan
from fileflow_api.jobs.contracts import JobResponse


class AccountCreate(BaseModel):
    display_name: str = Field(default="FileFlow user", min_length=2, max_length=80)
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=12, max_length=128)

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized.count("@") != 1 or normalized.startswith("@") or normalized.endswith("@"):
            raise ValueError("email must be a valid address")
        return normalized

    @field_validator("display_name")
    @classmethod
    def valid_display_name(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if len(normalized) < 2:
            raise ValueError("display name must contain at least 2 characters")
        return normalized


class AccountLogin(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=1, max_length=128)


class PasswordForgot(BaseModel):
    email: str = Field(min_length=3, max_length=320)


class PasswordReset(BaseModel):
    token: str = Field(min_length=32, max_length=256)
    new_password: str = Field(min_length=12, max_length=128)


class PasswordChange(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=12, max_length=128)


class AccountResponse(BaseModel):
    id: str
    email: str
    display_name: str
    plan: AccountPlan
    created_at: datetime
    has_avatar: bool = False


class SessionResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    account: AccountResponse


class LimitResponse(BaseModel):
    plan: AccountPlan
    cloud_jobs_used: int
    cloud_jobs_limit: int
    resets_at: datetime


class HistoryResponse(BaseModel):
    items: list[JobResponse]
    limit: int
    offset: int


class ApiKeyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class ApiKeyResponse(BaseModel):
    id: str
    name: str
    prefix: str
    created_at: datetime
    last_used_at: datetime | None


class ApiKeyCreated(ApiKeyResponse):
    key: str


class ApiKeyList(BaseModel):
    items: list[ApiKeyResponse]
