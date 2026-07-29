from pydantic import BaseModel, ConfigDict, Field

from fileflow_api.analytics.models import EventName


class EventCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: EventName
    intent: str | None = Field(default=None, pattern=r"^[a-z][a-z0-9-]{1,63}$")


class EventAccepted(BaseModel):
    accepted: bool = True


class VisitCounts(BaseModel):
    total: int
    today: int


class OperationCountUpdate(BaseModel):
    count: int = Field(ge=1, le=20)


class OperationCounts(BaseModel):
    total: int
