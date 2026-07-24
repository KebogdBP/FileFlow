from fastapi import APIRouter, Request, Response, status

from fileflow_api.uploads.contracts import (
    PartUploadedResponse,
    PartUrlResponse,
    UploadComplete,
    UploadCreate,
    UploadResponse,
)
from fileflow_api.uploads.service import UploadService

router = APIRouter(prefix="/uploads", tags=["uploads"])


def service(request: Request) -> UploadService:
    upload_service: UploadService = request.app.state.upload_service
    return upload_service


@router.post("", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
def create_upload(payload: UploadCreate, request: Request) -> UploadResponse:
    return UploadResponse.model_validate(service(request).create(payload), from_attributes=True)


@router.get("/{upload_id}", response_model=UploadResponse)
def get_upload(upload_id: str, request: Request) -> UploadResponse:
    return UploadResponse.model_validate(service(request).get(upload_id), from_attributes=True)


@router.post("/{upload_id}/parts/{part_number}", response_model=PartUrlResponse)
def create_part_url(upload_id: str, part_number: int, request: Request) -> PartUrlResponse:
    url, ttl = service(request).presign(upload_id, part_number)
    return PartUrlResponse(part_number=part_number, url=url, expires_in_seconds=ttl)


@router.put("/{upload_id}/parts/{part_number}", response_model=PartUploadedResponse)
async def upload_part(upload_id: str, part_number: int, request: Request) -> PartUploadedResponse:
    body = await request.body()
    etag = service(request).upload_part(upload_id, part_number, body)
    return PartUploadedResponse(part_number=part_number, etag=etag)


@router.post("/{upload_id}/complete", response_model=UploadResponse)
def complete_upload(upload_id: str, payload: UploadComplete, request: Request) -> UploadResponse:
    upload = service(request).complete(upload_id, payload.parts)
    return UploadResponse.model_validate(upload, from_attributes=True)


@router.delete("/{upload_id}", status_code=status.HTTP_204_NO_CONTENT)
def abort_upload(upload_id: str, request: Request) -> Response:
    service(request).abort(upload_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
