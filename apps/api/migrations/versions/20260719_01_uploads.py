"""Create temporary upload metadata tables."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260719_01"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    status = sa.Enum("UPLOADING", "COMPLETED", "ABORTED", "EXPIRED", name="uploadstatus")
    op.create_table(
        "uploads",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("object_key", sa.String(255), nullable=False, unique=True),
        sa.Column("multipart_id", sa.String(1024), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(127), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("part_size_bytes", sa.Integer(), nullable=False),
        sa.Column("part_count", sa.Integer(), nullable=False),
        sa.Column("status", status, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_uploads_status", "uploads", ["status"])
    op.create_index("ix_uploads_created_at", "uploads", ["created_at"])
    op.create_index("ix_uploads_expires_at", "uploads", ["expires_at"])
    op.create_table(
        "upload_parts",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            "upload_id",
            sa.String(32),
            sa.ForeignKey("uploads.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("part_number", sa.Integer(), nullable=False),
        sa.Column("etag", sa.String(255), nullable=False),
        sa.UniqueConstraint("upload_id", "part_number"),
    )
    op.create_index("ix_upload_parts_upload_id", "upload_parts", ["upload_id"])


def downgrade() -> None:
    op.drop_table("upload_parts")
    op.drop_table("uploads")
