from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from fileflow_api.database import Base


class AiUsage(Base):
    __tablename__ = "ai_usage"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    account_id: Mapped[str] = mapped_column(
        ForeignKey("accounts.id", ondelete="CASCADE"), index=True
    )
    model: Mapped[str] = mapped_column(String(80))
    input_characters: Mapped[int] = mapped_column(Integer)
    output_characters: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
