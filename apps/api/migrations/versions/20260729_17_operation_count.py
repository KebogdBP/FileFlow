"""Add completed operations to product analytics."""

from collections.abc import Sequence

from alembic import op

revision: str = "20260729_17"
down_revision: str | None = "20260729_16"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("ALTER TYPE eventname ADD VALUE IF NOT EXISTS 'COMPLETED_OPERATION'")


def downgrade() -> None:
    # PostgreSQL enum values cannot be removed safely while rows may reference them.
    pass
