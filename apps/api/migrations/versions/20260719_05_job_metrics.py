"""Add worker resource metrics."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260719_05"
down_revision: str | None = "20260719_04"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("runtime_ms", sa.BigInteger()))
    op.add_column("jobs", sa.Column("peak_memory_bytes", sa.BigInteger()))


def downgrade() -> None:
    op.drop_column("jobs", "peak_memory_bytes")
    op.drop_column("jobs", "runtime_ms")
