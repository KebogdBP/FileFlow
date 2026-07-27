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
    cross_origin_resource_policy: Literal["same-site", "cross-origin"] = "same-site"
    redis_url: str = "redis://localhost:6379/0"
    job_soft_time_limit_seconds: int = Field(default=14 * 60, ge=30)
    job_time_limit_seconds: int = Field(default=15 * 60, ge=60)
    max_active_jobs_per_upload: int = Field(default=1, ge=1, le=10)
    free_daily_cloud_jobs: int = Field(default=10, ge=1, le=1000)
    account_session_ttl_seconds: int = Field(default=30 * 24 * 60 * 60, ge=300)
    password_reset_ttl_seconds: int = Field(default=30 * 60, ge=300, le=24 * 60 * 60)
    web_base_url: str = "http://localhost:3000"
    smtp_host: str | None = None
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str = "no-reply@fileflow.pro"
    smtp_use_tls: bool = True
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
    ffmpeg_path: str = "/usr/bin/ffmpeg"
    ffprobe_path: str = "/usr/bin/ffprobe"
    libreoffice_path: str = "/usr/bin/libreoffice"
    qpdf_path: str = "/usr/bin/qpdf"
    ghostscript_path: str = "/usr/bin/gs"
    pdftoppm_path: str = "/usr/bin/pdftoppm"
    social_import_cookies_file: str | None = None
    social_import_pot_provider_url: str | None = None
    social_import_proxy_url: str | None = None
    allowed_origins: list[AnyHttpUrl] = Field(
        default_factory=lambda: [AnyHttpUrl("http://localhost:3000")]
    )
    trusted_hosts: list[str] = Field(default_factory=lambda: ["localhost", "testserver"])

    @property
    def docs_enabled(self) -> bool:
        return self.environment != "production"

    @property
    def beta_readiness_checks(self) -> dict[str, bool]:
        origins = [str(origin).rstrip("/") for origin in self.allowed_origins]
        return {
            "production_environment": self.environment == "production",
            "non_default_storage_credentials": self.s3_secret_key != "fileflow-local-only",
            "https_origins_only": bool(origins)
            and all(origin.startswith("https://") for origin in origins),
            "restricted_trusted_hosts": bool(self.trusted_hosts)
            and "*" not in self.trusted_hosts
            and all(host not in {"localhost", "testserver"} for host in self.trusted_hosts),
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
