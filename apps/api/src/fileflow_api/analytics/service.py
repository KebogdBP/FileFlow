from datetime import UTC, datetime

from sqlalchemy.orm import Session, sessionmaker

from fileflow_api.analytics.contracts import EventCreate
from fileflow_api.analytics.models import ProductEvent


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
