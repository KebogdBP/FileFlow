"""Add playlist and generic-audio downloader modes."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260728_15"
down_revision: str | None = "20260728_14"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("social_imports", sa.Column("playlist_count", sa.Integer(), nullable=True))
    op.add_column(
        "social_imports",
        sa.Column("generic_audio", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("social_imports", "generic_audio")
    op.drop_column("social_imports", "playlist_count")
