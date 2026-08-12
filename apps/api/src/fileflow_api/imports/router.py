from collections.abc import Iterator

from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import StreamingResponse

from fileflow_api.downloads import attachment_disposition
from fileflow_api.imports.contracts import DirectDownloadTicket, ImportCreate, ImportResponse
from fileflow_api.imports.downloader import ImportDownloadError
from fileflow_api.imports.service import SocialImportService

router = APIRouter(prefix="/imports", tags=["imports"])


def service(request: Request) -> SocialImportService:
    result: SocialImportService = request.app.state.import_service
    return result


@router.post("", response_model=ImportResponse, status_code=status.HTTP_202_ACCEPTED)
def create_import(payload: ImportCreate, request: Request) -> ImportResponse:
    return ImportResponse.model_validate(service(request).create(payload), from_attributes=True)


@router.post("/direct", response_model=DirectDownloadTicket)
def create_direct_download(payload: ImportCreate, request: Request) -> DirectDownloadTicket:
    return service(request).create_direct_ticket(payload)


@router.get("/direct/{ticket}")
def download_direct(ticket: str, request: Request) -> StreamingResponse:
    try:
        prepared = service(request).prepare_direct_download(ticket)
    except ImportDownloadError as error:
        raise HTTPException(status_code=502, detail=error.code) from None
    size = prepared.media.path.stat().st_size

    def stream_file() -> Iterator[bytes]:
        try:
            with prepared.media.path.open("rb") as source:
                while chunk := source.read(1024 * 1024):
                    yield chunk
        finally:
            prepared.cleanup()

    return StreamingResponse(
        stream_file(),
        media_type=prepared.media.content_type,
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": attachment_disposition(prepared.media.filename),
            "Content-Length": str(size),
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/{import_id}", response_model=ImportResponse)
def get_import(import_id: str, request: Request) -> ImportResponse:
    return ImportResponse.model_validate(service(request).get(import_id), from_attributes=True)


@router.get("/{import_id}/result")
def download_import(import_id: str, request: Request) -> StreamingResponse:
    upload = service(request).downloadable_upload(import_id)
    storage = request.app.state.object_storage
    return StreamingResponse(
        storage.iter_object(upload.object_key),
        media_type=upload.content_type,
        headers={
            "Content-Disposition": attachment_disposition(upload.filename),
            "Content-Length": str(upload.size_bytes),
        },
    )
