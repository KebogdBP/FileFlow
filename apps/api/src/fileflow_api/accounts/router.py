from typing import Annotated

from fastapi import APIRouter, Header, HTTPException, Query, Request, status

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
    SessionResponse,
)
from fileflow_api.accounts.models import Account
from fileflow_api.accounts.service import AccountService
from fileflow_api.jobs.contracts import JobResponse

router = APIRouter(prefix="/account", tags=["account"])


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


@router.post("/register", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
def register(payload: AccountCreate, request: Request) -> SessionResponse:
    account, token, expires_at = service(request).register(payload.email, payload.password)
    return SessionResponse(
        access_token=token,
        expires_at=expires_at,
        account=AccountResponse.model_validate(account, from_attributes=True),
    )


@router.post("/login", response_model=SessionResponse)
def login(payload: AccountLogin, request: Request) -> SessionResponse:
    account, token, expires_at = service(request).login(payload.email, payload.password)
    return SessionResponse(
        access_token=token,
        expires_at=expires_at,
        account=AccountResponse.model_validate(account, from_attributes=True),
    )


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
