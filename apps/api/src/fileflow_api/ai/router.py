from io import BytesIO

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from fileflow_api.accounts.router import current_account
from fileflow_api.ai.contracts import (
    SubtitleAssistRequest,
    SubtitleAssistResponse,
    SubtitleDocumentRequest,
)
from fileflow_api.ai.documents import subtitle_docx
from fileflow_api.ai.service import SubtitleAiService
from fileflow_api.downloads import attachment_disposition

router = APIRouter(prefix="/subtitles", tags=["subtitles"])


@router.post("/assist", response_model=SubtitleAssistResponse)
def assist(payload: SubtitleAssistRequest, request: Request) -> SubtitleAssistResponse:
    account = current_account(request, request.headers.get("Authorization"))
    service: SubtitleAiService = request.app.state.subtitle_ai_service
    return service.assist(account.id, payload)


@router.post("/docx")
def create_docx(payload: SubtitleDocumentRequest, request: Request) -> StreamingResponse:
    current_account(request, request.headers.get("Authorization"))
    result = subtitle_docx(payload.title.strip(), payload.text.strip())
    return StreamingResponse(
        BytesIO(result),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": attachment_disposition("fileflow-subtitles.docx"),
            "Content-Length": str(len(result)),
        },
    )
