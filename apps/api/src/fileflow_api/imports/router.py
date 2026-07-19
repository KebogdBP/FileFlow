from fastapi import APIRouter, Request, status

from fileflow_api.imports.contracts import ImportCreate, ImportResponse
from fileflow_api.imports.service import SocialImportService

router = APIRouter(prefix="/imports", tags=["imports"])


def service(request: Request) -> SocialImportService:
    result: SocialImportService = request.app.state.import_service
    return result


@router.post("", response_model=ImportResponse, status_code=status.HTTP_202_ACCEPTED)
def create_import(payload: ImportCreate, request: Request) -> ImportResponse:
    return ImportResponse.model_validate(service(request).create(payload), from_attributes=True)


@router.get("/{import_id}", response_model=ImportResponse)
def get_import(import_id: str, request: Request) -> ImportResponse:
    return ImportResponse.model_validate(service(request).get(import_id), from_attributes=True)
