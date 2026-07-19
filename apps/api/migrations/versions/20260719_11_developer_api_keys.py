"""Add revocable developer API keys."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260719_11"
down_revision: str | None = "20260719_10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "developer_api_keys",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("account_id", sa.String(length=32), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("prefix", sa.String(length=16), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_developer_api_keys_account_id", "developer_api_keys", ["account_id"])
    op.create_index("ix_developer_api_keys_prefix", "developer_api_keys", ["prefix"])
    op.create_index(
        "ix_developer_api_keys_token_hash", "developer_api_keys", ["token_hash"], unique=True
    )


def downgrade() -> None:
    op.drop_table("developer_api_keys")
