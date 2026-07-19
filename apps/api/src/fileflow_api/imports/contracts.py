from datetime import datetime
from typing import Literal

from pydantic import BaseModel, HttpUrl

from fileflow_api.imports.models import ImportStatus


class ImportCreate(BaseModel):
    url: HttpUrl
    rights_basis: Literal["owned", "authorized", "public_domain"]
    rights_confirmed: Literal[True]


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
