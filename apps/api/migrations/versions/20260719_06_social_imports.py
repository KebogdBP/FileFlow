"""Create rights-aware social imports."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260719_06"
down_revision: str | None = "20260719_05"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    status = sa.Enum("QUEUED", "RUNNING", "COMPLETED", "FAILED", name="importstatus")
    op.create_table(
        "social_imports",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("source_url", sa.String(2048), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("rights_basis", sa.String(32), nullable=False),
        sa.Column("status", status, nullable=False),
        sa.Column("task_id", sa.String(255)),
        sa.Column(
            "upload_id",
            sa.String(32),
            sa.ForeignKey("uploads.id", ondelete="SET NULL"),
        ),
        sa.Column("title", sa.String(500)),
        sa.Column("creator", sa.String(255)),
        sa.Column("thumbnail_url", sa.String(2048)),
        sa.Column("error_code", sa.String(64)),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True)),
    )
    op.create_index("ix_social_imports_provider", "social_imports", ["provider"])
    op.create_index("ix_social_imports_status", "social_imports", ["status"])
    op.create_index("ix_social_imports_created_at", "social_imports", ["created_at"])


def downgrade() -> None:
    op.drop_table("social_imports")
