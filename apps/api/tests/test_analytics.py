from fastapi.testclient import TestClient
from sqlalchemy import create_engine, func, select
from sqlalchemy.pool import StaticPool

from fileflow_api.analytics.models import EventName, ProductEvent
from fileflow_api.analytics.service import AnalyticsService
from fileflow_api.app import create_app
from fileflow_api.config import Settings
from fileflow_api.database import Base, build_session_factory


def test_analytics_accepts_only_bounded_non_identifying_events() -> None:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    sessions = build_session_factory(engine)
    api = TestClient(
        create_app(Settings(environment="test"), analytics_service=AnalyticsService(sessions))
    )

    response = api.post(
        "/api/v1/analytics/events",
        json={"name": "intent_viewed", "intent": "compress-pdf"},
    )
    assert response.status_code == 202
    assert response.json() == {"accepted": True}
    assert (
        api.post(
            "/api/v1/analytics/events",
            json={
                "name": "intent_viewed",
                "intent": "compress-pdf",
                "filename": "private.pdf",
            },
        ).status_code
        == 422
    )

    with sessions() as session:
        event = session.scalar(select(ProductEvent))
        assert event is not None
        assert event.name == EventName.INTENT_VIEWED
        assert event.intent == "compress-pdf"
        assert session.scalar(select(func.count()).select_from(ProductEvent)) == 1
