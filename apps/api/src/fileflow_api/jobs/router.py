from fastapi import APIRouter, Request, status

from fileflow_api.accounts.router import current_account
from fileflow_api.jobs.contracts import JobCreate, JobResponse
from fileflow_api.jobs.service import JobService

router = APIRouter(prefix="/jobs", tags=["jobs"])


def service(request: Request) -> JobService:
    job_service: JobService = request.app.state.job_service
    return job_service


@router.post("", response_model=JobResponse, status_code=status.HTTP_202_ACCEPTED)
def create_job(payload: JobCreate, request: Request) -> JobResponse:
    account = current_account(request, request.headers.get("Authorization"))
    request.app.state.account_service.require_available_job(account.id)
    return JobResponse.model_validate(
        service(request).create(payload, account.id), from_attributes=True
    )


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: str, request: Request) -> JobResponse:
    account = current_account(request, request.headers.get("Authorization"))
    return JobResponse.model_validate(
        service(request).get_for_account(job_id, account.id), from_attributes=True
    )


@router.delete("/{job_id}", response_model=JobResponse)
def cancel_job(job_id: str, request: Request) -> JobResponse:
    account = current_account(request, request.headers.get("Authorization"))
    return JobResponse.model_validate(
        service(request).cancel_for_account(job_id, account.id), from_attributes=True
    )
