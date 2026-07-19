"""Remove mandatory rights attestation from social imports."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260719_08"
down_revision: str | None = "20260719_07"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("social_imports", "rights_basis")


def downgrade() -> None:
    op.add_column(
        "social_imports",
        sa.Column("rights_basis", sa.String(32), nullable=False, server_default="owned"),
    )
