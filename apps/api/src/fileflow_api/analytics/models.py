from datetime import datetime
from enum import StrEnum

from sqlalchemy import DateTime, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from fileflow_api.database import Base


class EventName(StrEnum):
    INTENT_VIEWED = "intent_viewed"
    WORKSPACE_OPENED = "workspace_opened"
    SITE_VISIT = "site_visit"


class ProductEvent(Base):
    __tablename__ = "product_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[EventName] = mapped_column(Enum(EventName), index=True)
    intent: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
