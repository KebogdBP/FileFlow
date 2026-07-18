"""Add upload safety verdict metadata."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260719_02"
down_revision: str | None = "20260719_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    safety_status = sa.Enum(
        "PENDING", "SCANNING", "CLEAN", "REJECTED", "ERROR", name="safetystatus"
    )
    safety_status.create(op.get_bind())
    op.add_column(
        "uploads",
        sa.Column(
            "safety_status",
            safety_status,
            nullable=False,
            server_default="PENDING",
        ),
    )
    op.add_column("uploads", sa.Column("detected_content_type", sa.String(127)))
    op.add_column("uploads", sa.Column("rejection_reason", sa.String(255)))
    op.add_column("uploads", sa.Column("scanned_at", sa.DateTime(timezone=True)))
    op.create_index("ix_uploads_safety_status", "uploads", ["safety_status"])
    op.alter_column("uploads", "safety_status", server_default=None)


def downgrade() -> None:
    op.drop_index("ix_uploads_safety_status", table_name="uploads")
    op.drop_column("uploads", "scanned_at")
    op.drop_column("uploads", "rejection_reason")
    op.drop_column("uploads", "detected_content_type")
    op.drop_column("uploads", "safety_status")
    sa.Enum(name="safetystatus").drop(op.get_bind())
