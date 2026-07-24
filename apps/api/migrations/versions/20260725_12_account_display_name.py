"""Add the account display name."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260725_12"
down_revision: str | None = "20260719_11"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column(
            "display_name",
            sa.String(length=80),
            nullable=False,
            server_default="FileFlow user",
        ),
    )
    op.alter_column("accounts", "display_name", server_default=None)


def downgrade() -> None:
    op.drop_column("accounts", "display_name")
