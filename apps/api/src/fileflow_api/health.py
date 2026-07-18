from fastapi import APIRouter

from fileflow_api.contracts import ServiceStatus

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live", response_model=ServiceStatus)
def liveness() -> ServiceStatus:
    return ServiceStatus(status="ok")


@router.get("/ready", response_model=ServiceStatus)
def readiness() -> ServiceStatus:
    # M11 will add database, Redis and object-storage checks to this contract.
    return ServiceStatus(status="ready")
