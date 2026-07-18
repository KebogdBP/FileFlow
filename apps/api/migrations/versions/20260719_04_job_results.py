"""Add cloud job result metadata."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260719_04"
down_revision: str | None = "20260719_03"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("result_object_key", sa.String(255)))
    op.add_column("jobs", sa.Column("result_content_type", sa.String(127)))
    op.add_column("jobs", sa.Column("result_size_bytes", sa.BigInteger()))


def downgrade() -> None:
    op.drop_column("jobs", "result_size_bytes")
    op.drop_column("jobs", "result_content_type")
    op.drop_column("jobs", "result_object_key")
