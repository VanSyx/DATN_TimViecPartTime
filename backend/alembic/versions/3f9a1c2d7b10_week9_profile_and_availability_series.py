"""week 9: seeker profile fields, availability series

Revision ID: 3f9a1c2d7b10
Revises: e1dc5883a5fd
Create Date: 2026-10-14 10:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3f9a1c2d7b10'
down_revision: Union[str, Sequence[str], None] = 'e1dc5883a5fd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('full_name', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('gender', sa.String(length=10), nullable=True))
    op.add_column('users', sa.Column('birth_year', sa.Integer(), nullable=True))
    op.add_column('users', sa.Column('ward', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('city', sa.String(length=100), nullable=True))
    op.add_column('availability_intervals', sa.Column('series_id', sa.Uuid(), nullable=True))
    op.create_index(
        op.f('ix_availability_intervals_series_id'), 'availability_intervals', ['series_id'], unique=False
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_availability_intervals_series_id'), table_name='availability_intervals')
    op.drop_column('availability_intervals', 'series_id')
    for col in ('city', 'ward', 'birth_year', 'gender', 'full_name'):
        op.drop_column('users', col)
