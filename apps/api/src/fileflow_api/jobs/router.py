from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from fileflow_api.accounts.router import current_account
from fileflow_api.downloads import attachment_disposition, converted_filename
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
        "text/vtt": ".vtt",
        "application/pdf": ".pdf",
        "image/jpeg": ".jpg",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
    }
    extension = extensions.get(job.result_content_type, ".bin")
    source_upload = request.app.state.upload_service.get(job.upload_id)
    filename = converted_filename(source_upload.filename, extension)
    storage = request.app.state.object_storage
    headers = {"Content-Disposition": attachment_disposition(filename)}
    if job.result_size_bytes is not None:
        headers["Content-Length"] = str(job.result_size_bytes)
    return StreamingResponse(
        storage.iter_object(job.result_object_key),
        media_type=job.result_content_type,
        headers=headers,
    )
