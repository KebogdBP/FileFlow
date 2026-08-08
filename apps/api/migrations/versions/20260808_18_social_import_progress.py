"""Add observable social import progress.

Revision ID: 20260808_18
Revises: 20260729_17
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260808_18"
down_revision: str | None = "20260729_17"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "social_imports",
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("social_imports", "progress")
