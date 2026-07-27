"""Add media, quality, trim and playlist-item import options."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260728_14"
down_revision: str | None = "20260727_13"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "social_imports",
        sa.Column("media_type", sa.String(length=16), nullable=False, server_default="video"),
    )
    op.add_column(
        "social_imports",
        sa.Column("video_quality", sa.String(length=16), nullable=False, server_default="best"),
    )
    op.add_column(
        "social_imports",
        sa.Column("audio_bitrate_kbps", sa.Integer(), nullable=False, server_default="192"),
    )
    op.add_column("social_imports", sa.Column("start_seconds", sa.Float(), nullable=True))
    op.add_column("social_imports", sa.Column("end_seconds", sa.Float(), nullable=True))
    op.add_column("social_imports", sa.Column("playlist_item", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("social_imports", "playlist_item")
    op.drop_column("social_imports", "end_seconds")
    op.drop_column("social_imports", "start_seconds")
    op.drop_column("social_imports", "audio_bitrate_kbps")
    op.drop_column("social_imports", "video_quality")
    op.drop_column("social_imports", "media_type")
