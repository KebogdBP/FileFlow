from datetime import datetime

from pydantic import BaseModel, HttpUrl

from fileflow_api.imports.models import ImportStatus


class ImportCreate(BaseModel):
    url: HttpUrl


class ImportResponse(BaseModel):
    id: str
    provider: str
    status: ImportStatus
    upload_id: str | None
    title: str | None
    creator: str | None
    thumbnail_url: str | None
    error_code: str | None
    created_at: datetime
    finished_at: datetime | None
