from fastapi import APIRouter, Request, status

from fileflow_api.analytics.contracts import EventAccepted, EventCreate, VisitCounts
from fileflow_api.analytics.service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.post("/events", response_model=EventAccepted, status_code=status.HTTP_202_ACCEPTED)
def record_event(payload: EventCreate, request: Request) -> EventAccepted:
    service: AnalyticsService = request.app.state.analytics_service
    service.record(payload)
    return EventAccepted()


@router.get("/visits", response_model=VisitCounts)
def get_visit_counts(request: Request) -> VisitCounts:
    service: AnalyticsService = request.app.state.analytics_service
    total, today = service.visit_counts(record_visit=False)
    return VisitCounts(total=total, today=today)


@router.post("/visits", response_model=VisitCounts)
def record_visit(request: Request) -> VisitCounts:
    service: AnalyticsService = request.app.state.analytics_service
    total, today = service.visit_counts(record_visit=True)
    return VisitCounts(total=total, today=today)
