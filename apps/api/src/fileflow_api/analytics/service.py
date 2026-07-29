from datetime import UTC, datetime, time
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from fileflow_api.analytics.contracts import EventCreate
from fileflow_api.analytics.models import EventName, ProductEvent

MOSCOW = ZoneInfo("Europe/Moscow")


class AnalyticsService:
    def __init__(self, sessions: sessionmaker[Session]) -> None:
        self._sessions = sessions

    def record(self, payload: EventCreate) -> None:
        with self._sessions.begin() as session:
            session.add(
                ProductEvent(
                    name=payload.name, intent=payload.intent, occurred_at=datetime.now(UTC)
                )
            )

    def visit_counts(self, record_visit: bool) -> tuple[int, int]:
        now = datetime.now(UTC)
        today_start = datetime.combine(now.astimezone(MOSCOW).date(), time.min, MOSCOW).astimezone(
            UTC
        )
        with self._sessions.begin() as session:
            if record_visit:
                session.add(ProductEvent(name=EventName.SITE_VISIT, intent=None, occurred_at=now))
                session.flush()
            total = session.scalar(
                select(func.count())
                .select_from(ProductEvent)
                .where(ProductEvent.name == EventName.SITE_VISIT)
            )
            today = session.scalar(
                select(func.count())
                .select_from(ProductEvent)
                .where(
                    ProductEvent.name == EventName.SITE_VISIT,
                    ProductEvent.occurred_at >= today_start,
                )
            )
        return int(total or 0), int(today or 0)

    def operation_count(self, increment: int = 0) -> int:
        now = datetime.now(UTC)
        with self._sessions.begin() as session:
            if increment:
                session.add_all(
                    ProductEvent(
                        name=EventName.COMPLETED_OPERATION,
                        intent=None,
                        occurred_at=now,
                    )
                    for _ in range(increment)
                )
                session.flush()
            total = session.scalar(
                select(func.count())
                .select_from(ProductEvent)
                .where(ProductEvent.name == EventName.COMPLETED_OPERATION)
            )
        return int(total or 0)
