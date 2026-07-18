from decimal import Decimal
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
    redis_url: str = "redis://localhost:6379/0"
    job_soft_time_limit_seconds: int = Field(default=14 * 60, ge=30)
    job_time_limit_seconds: int = Field(default=15 * 60, ge=60)
    max_active_jobs_per_upload: int = Field(default=1, ge=1, le=10)
    worker_max_output_bytes: int = Field(default=2 * 1024 * 1024 * 1024, gt=0)
    worker_memory_limit_bytes: int = Field(default=2 * 1024 * 1024 * 1024, ge=128 * 1024 * 1024)
    worker_cpu_limit_seconds: int = Field(default=15 * 60, ge=10)
    worker_file_limit: int = Field(default=64, ge=8, le=1024)
    cost_compute_per_second_usd: Decimal = Field(default=Decimal("0.00002"), ge=0)
    cost_memory_gib_second_usd: Decimal = Field(default=Decimal("0.000002"), ge=0)
    cost_storage_gib_month_usd: Decimal = Field(default=Decimal("0.023"), ge=0)
    cost_egress_gib_usd: Decimal = Field(default=Decimal("0.09"), ge=0)
    cost_request_usd: Decimal = Field(default=Decimal("0.00001"), ge=0)
    cost_retention_hours: Decimal = Field(default=Decimal("1"), ge=0)
    allowed_origins: list[AnyHttpUrl] = Field(
        default_factory=lambda: [AnyHttpUrl("http://localhost:3000")]
    )

    @property
    def docs_enabled(self) -> bool:
        return self.environment != "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
