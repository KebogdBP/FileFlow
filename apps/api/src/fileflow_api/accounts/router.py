from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Query, Request, Response, status

from fileflow_api.accounts.contracts import (
    AccountCreate,
    AccountLogin,
    AccountResponse,
    ApiKeyCreate,
    ApiKeyCreated,
    ApiKeyList,
    ApiKeyResponse,
    HistoryResponse,
    LimitResponse,
    PasswordChange,
    PasswordForgot,
    PasswordReset,
    SessionResponse,
)
from fileflow_api.accounts.models import Account
from fileflow_api.accounts.service import AccountService
from fileflow_api.contracts import MessageResponse
from fileflow_api.jobs.contracts import JobResponse

router = APIRouter(prefix="/account", tags=["account"])
MAX_AVATAR_BYTES = 5 * 1024 * 1024
AVATAR_TYPES = {"image/jpeg", "image/png", "image/webp"}


def service(request: Request) -> AccountService:
    value: AccountService = request.app.state.account_service
    return value


def bearer(authorization: Annotated[str | None, Header()] = None) -> str:
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication is required.")
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Authentication is required.")
    return token


def current_account(
    request: Request, authorization: Annotated[str | None, Header()] = None
) -> Account:
    return service(request).authenticate(bearer(authorization))


def session_response(account: Account, token: str, expires_at: datetime) -> SessionResponse:
    return SessionResponse(
        access_token=token,
        expires_at=expires_at,
        account=AccountResponse.model_validate(account, from_attributes=True),
    )


@router.post("/register", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def register(payload: AccountCreate, request: Request) -> SessionResponse:
    account, token, expires_at = service(request).register(
        payload.email, payload.password, payload.display_name
    )
    return session_response(account, token, expires_at)


@router.post("/login", response_model=SessionResponse)
def login(payload: AccountLogin, request: Request) -> SessionResponse:
    account, token, expires_at = service(request).login(payload.email, payload.password)
    return session_response(account, token, expires_at)


@router.post(
    "/password/forgot", response_model=MessageResponse, status_code=status.HTTP_202_ACCEPTED
)
def forgot_password(payload: PasswordForgot, request: Request) -> MessageResponse:
    service(request).request_password_reset(payload.email)
    return MessageResponse(
        message="If an account uses this email, a password reset link has been sent."
    )


@router.post("/password/reset", response_model=SessionResponse)
def reset_password(payload: PasswordReset, request: Request) -> SessionResponse:
    account, token, expires_at = service(request).reset_password(
        payload.token, payload.new_password
    )
    return session_response(account, token, expires_at)


@router.post("/password/change", response_model=SessionResponse)
def change_password(
    payload: PasswordChange,
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
) -> SessionResponse:
    account = current_account(request, authorization)
    updated, token, expires_at = service(request).change_password(
        account.id, payload.current_password, payload.new_password
    )
    return session_response(updated, token, expires_at)


@router.put("/avatar", status_code=status.HTTP_204_NO_CONTENT)
async def upload_avatar(
    request: Request, authorization: Annotated[str | None, Header()] = None
) -> None:
    account = current_account(request, authorization)
    content_type = request.headers.get("content-type", "").split(";", 1)[0].lower()
    if content_type not in AVATAR_TYPES:
        raise HTTPException(status_code=415, detail="Avatar must be a JPEG, PNG, or WebP image.")
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > MAX_AVATAR_BYTES:
            raise HTTPException(status_code=413, detail="Avatar must not exceed 5 MB.")
        chunks.append(chunk)
    data = b"".join(chunks)
    valid = (
        (content_type == "image/jpeg" and data.startswith(b"\xff\xd8\xff"))
        or (content_type == "image/png" and data.startswith(b"\x89PNG\r\n\x1a\n"))
        or (
            content_type == "image/webp"
            and len(data) >= 12
            and data.startswith(b"RIFF")
            and data[8:12] == b"WEBP"
        )
    )
    if not valid:
        raise HTTPException(status_code=400, detail="Avatar file signature is invalid.")
    service(request).save_avatar(account.id, content_type, data)


@router.get("/avatar")
def avatar(request: Request, authorization: Annotated[str | None, Header()] = None) -> Response:
    account = current_account(request, authorization)
    content_type, data = service(request).avatar(account.id)
    return Response(content=data, media_type=content_type)


@router.delete("/session", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, authorization: Annotated[str | None, Header()] = None) -> None:
    service(request).logout(bearer(authorization))


@router.get("/me", response_model=AccountResponse)
def me(request: Request, authorization: Annotated[str | None, Header()] = None) -> AccountResponse:
    return AccountResponse.model_validate(
        current_account(request, authorization), from_attributes=True
    )


@router.get("/history", response_model=HistoryResponse)
def history(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> HistoryResponse:
    account = current_account(request, authorization)
    items = [
        JobResponse.model_validate(job, from_attributes=True)
        for job in service(request).history(account.id, limit, offset)
    ]
    return HistoryResponse(items=items, limit=limit, offset=offset)


@router.get("/limits", response_model=LimitResponse)
def limits(
    request: Request, authorization: Annotated[str | None, Header()] = None
) -> LimitResponse:
    account = current_account(request, authorization)
    used, resets_at = service(request).usage(account.id)
    return LimitResponse(
        plan=account.plan,
        cloud_jobs_used=used,
        cloud_jobs_limit=request.app.state.settings.free_daily_cloud_jobs,
        resets_at=resets_at,
    )


@router.post("/api-keys", response_model=ApiKeyCreated, status_code=status.HTTP_201_CREATED)
def create_api_key(
    payload: ApiKeyCreate,
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
) -> ApiKeyCreated:
    account = current_account(request, authorization)
    api_key, token = service(request).create_api_key(account.id, payload.name)
    return ApiKeyCreated(
        **ApiKeyResponse.model_validate(api_key, from_attributes=True).model_dump(), key=token
    )


@router.get("/api-keys", response_model=ApiKeyList)
def api_keys(request: Request, authorization: Annotated[str | None, Header()] = None) -> ApiKeyList:
    account = current_account(request, authorization)
    return ApiKeyList(
        items=[
            ApiKeyResponse.model_validate(item, from_attributes=True)
            for item in service(request).api_keys(account.id)
        ]
    )


@router.delete("/api-keys/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_api_key(
    key_id: str,
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    account = current_account(request, authorization)
    service(request).revoke_api_key(account.id, key_id)
