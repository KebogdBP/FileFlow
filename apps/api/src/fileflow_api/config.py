from functools import lru_cache
from typing import Literal

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="FILEFLOW_",
        env_file=(".env", ".env.local"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "FileFlow API"
    environment: Literal["development", "test", "production"] = "development"
    api_prefix: str = "/api/v1"
    database_url: str = "postgresql+psycopg://fileflow:fileflow@localhost:5432/fileflow"
    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "fileflow"
    s3_secret_key: str = "fileflow-local-only"
    s3_bucket: str = "fileflow-temporary"
    s3_region: str = "us-east-1"
    upload_part_size_bytes: int = Field(default=8 * 1024 * 1024, ge=5 * 1024 * 1024)
    max_upload_bytes: int = Field(default=2 * 1024 * 1024 * 1024, gt=0)
    upload_retention_seconds: int = Field(default=60 * 60, ge=300)
    upload_url_ttl_seconds: int = Field(default=15 * 60, ge=60, le=60 * 60)
    malware_scanner_host: str = "localhost"
    malware_scanner_port: int = Field(default=3310, ge=1, le=65535)
    malware_scanner_timeout_seconds: float = Field(default=30.0, gt=0, le=300)
    safety_header_bytes: int = Field(default=16 * 1024, ge=512, le=1024 * 1024)
    allowed_origins: list[AnyHttpUrl] = Field(
        default_factory=lambda: [AnyHttpUrl("http://localhost:3000")]
    )

    @property
    def docs_enabled(self) -> bool:
        return self.environment != "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
