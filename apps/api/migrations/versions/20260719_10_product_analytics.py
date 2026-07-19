"""Add privacy-safe product events."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260719_10"
down_revision: str | None = "20260719_09"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    event_name = sa.Enum("INTENT_VIEWED", "WORKSPACE_OPENED", name="eventname")
    event_name.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "product_events",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", event_name, nullable=False),
        sa.Column("intent", sa.String(length=64), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_product_events_name", "product_events", ["name"])
    op.create_index("ix_product_events_intent", "product_events", ["intent"])
    op.create_index("ix_product_events_occurred_at", "product_events", ["occurred_at"])


def downgrade() -> None:
    op.drop_table("product_events")
    sa.Enum(name="eventname").drop(op.get_bind(), checkfirst=True)
