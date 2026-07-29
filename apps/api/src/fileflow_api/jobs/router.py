from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse

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


@router.get("/{job_id}/result")
def download_result(job_id: str, request: Request) -> StreamingResponse:
    account = current_account(request, request.headers.get("Authorization"))
    job = service(request).get_for_account(job_id, account.id)
    if job.status.value != "succeeded" or not job.result_object_key or not job.result_content_type:
        raise HTTPException(status_code=409, detail="Job result is not available.")
    extensions = {
        "video/mp4": ".mp4",
        "audio/mpeg": ".mp3",
        "audio/wav": ".wav",
        "application/pdf": ".pdf",
        "image/jpeg": ".jpg",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    }
    extension = extensions.get(job.result_content_type, ".bin")
    filename = f"fileflow-{job.operation}{extension}"
    storage = request.app.state.object_storage
    return StreamingResponse(
        storage.iter_object(job.result_object_key),
        media_type=job.result_content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
