"""seed full mosmade men and women size grids

Revision ID: v2w3x4y5z678
Revises: u1v2w3x4y567
"""

from alembic import op
from sqlalchemy.orm import Session

from app.services.size_grids_seed import seed_mosmade_reference_grids


revision = "v2w3x4y5z678"
down_revision = "u1v2w3x4y567"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    session = Session(bind=bind)
    try:
        seed_mosmade_reference_grids(session)
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def downgrade() -> None:
    # Keep schema; remove Mosmade reference seed rows/grids only.
    op.execute(
        """
        DELETE FROM size_grid_rows
        WHERE size_grid_id IN (
          SELECT id FROM size_grids
          WHERE name IN ('Мужская (Mosmade)', 'Женская (Mosmade)')
        )
        """
    )
    op.execute(
        """
        DELETE FROM size_grids
        WHERE name IN ('Мужская (Mosmade)', 'Женская (Mosmade)')
        """
    )
