"""Add password reset tokens and account avatars."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260727_13"
down_revision: str | None = "20260725_12"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("accounts", sa.Column("avatar_content_type", sa.String(length=32), nullable=True))
    op.add_column("accounts", sa.Column("avatar_data", sa.LargeBinary(), nullable=True))
    op.create_table(
        "password_reset_tokens",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("account_id", sa.String(length=32), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_password_reset_tokens_account_id"),
        "password_reset_tokens",
        ["account_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_password_reset_tokens_expires_at"),
        "password_reset_tokens",
        ["expires_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_password_reset_tokens_token_hash"),
        "password_reset_tokens",
        ["token_hash"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_password_reset_tokens_token_hash"), table_name="password_reset_tokens")
    op.drop_index(op.f("ix_password_reset_tokens_expires_at"), table_name="password_reset_tokens")
    op.drop_index(op.f("ix_password_reset_tokens_account_id"), table_name="password_reset_tokens")
    op.drop_table("password_reset_tokens")
    op.drop_column("accounts", "avatar_data")
    op.drop_column("accounts", "avatar_content_type")
