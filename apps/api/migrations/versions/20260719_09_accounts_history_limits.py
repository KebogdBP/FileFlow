"""Add accounts, sessions, owned job history and quota accounting."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260719_09"
down_revision: str | None = "20260719_08"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    plan = sa.Enum("FREE", name="accountplan")
    plan.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "accounts",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("plan", plan, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_accounts_email", "accounts", ["email"], unique=True)
    op.create_table(
        "account_sessions",
        sa.Column("id", sa.String(length=32), nullable=False),
        sa.Column("account_id", sa.String(length=32), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_account_sessions_account_id", "account_sessions", ["account_id"])
    op.create_index("ix_account_sessions_expires_at", "account_sessions", ["expires_at"])
    op.create_index(
        "ix_account_sessions_token_hash", "account_sessions", ["token_hash"], unique=True
    )
    op.add_column("jobs", sa.Column("account_id", sa.String(length=32), nullable=True))
    op.create_foreign_key(
        "fk_jobs_account_id", "jobs", "accounts", ["account_id"], ["id"], ondelete="SET NULL"
    )
    op.create_index("ix_jobs_account_id", "jobs", ["account_id"])


def downgrade() -> None:
    op.drop_index("ix_jobs_account_id", table_name="jobs")
    op.drop_constraint("fk_jobs_account_id", "jobs", type_="foreignkey")
    op.drop_column("jobs", "account_id")
    op.drop_table("account_sessions")
    op.drop_index("ix_accounts_email", table_name="accounts")
    op.drop_table("accounts")
    sa.Enum(name="accountplan").drop(op.get_bind(), checkfirst=True)
