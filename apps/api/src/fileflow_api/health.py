from datetime import UTC, datetime

from fastapi import APIRouter, Request, Response, status

from fileflow_api.contracts import BetaReadiness, ServiceStatus

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live", response_model=ServiceStatus)
def liveness() -> ServiceStatus:
    return ServiceStatus(status="ok")


@router.get("/ready", response_model=ServiceStatus)
def readiness() -> ServiceStatus:
    # M11 will add database, Redis and object-storage checks to this contract.
    return ServiceStatus(status="ready")


@router.get("/beta", response_model=BetaReadiness)
def beta_readiness(request: Request, response: Response) -> BetaReadiness:
    checks = request.app.state.settings.beta_readiness_checks
    ready = all(checks.values())
    if not ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return BetaReadiness(
        status="ready" if ready else "blocked",
        checks=checks,
        checked_at=datetime.now(UTC),
    )
