"""Add clean multi-source jobs for document operations."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260719_07"
down_revision: str | None = "20260719_06"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("source_upload_ids", sa.JSON(), nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("jobs", "source_upload_ids")
