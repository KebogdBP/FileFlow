"""Add subtitle language to social imports.

Revision ID: 20260808_19
Revises: 20260808_18
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260808_19"
down_revision: str | None = "20260808_18"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "social_imports",
        sa.Column("subtitle_language", sa.String(length=16), nullable=False, server_default="en"),
    )


def downgrade() -> None:
    op.drop_column("social_imports", "subtitle_language")
