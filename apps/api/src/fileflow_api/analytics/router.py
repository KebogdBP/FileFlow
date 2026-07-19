from fastapi import APIRouter, Request, status

from fileflow_api.analytics.contracts import EventAccepted, EventCreate
from fileflow_api.analytics.service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.post("/events", response_model=EventAccepted, status_code=status.HTTP_202_ACCEPTED)
def record_event(payload: EventCreate, request: Request) -> EventAccepted:
    service: AnalyticsService = request.app.state.analytics_service
    service.record(payload)
    return EventAccepted()
