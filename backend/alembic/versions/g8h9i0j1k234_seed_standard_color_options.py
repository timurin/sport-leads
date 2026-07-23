"""seed 50 standard colors for system color characteristic

Revision ID: g8h9i0j1k234
Revises: f7a8b9c0d123
"""

from alembic import op
from sqlalchemy.orm import Session

from app.services.characteristic_colors_seed import seed_standard_color_options


revision = "g8h9i0j1k234"
down_revision = "f7a8b9c0d123"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    session = Session(bind=bind)
    try:
        seed_standard_color_options(session)
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def downgrade() -> None:
    # Keep custom/user colors; remove only unused seeded standard codes.
    op.execute(
        """
        DELETE FROM characteristic_options
        WHERE characteristic_id IN (
          SELECT id FROM characteristic_definitions WHERE code = 'color'
        )
        AND code IN (
          'white','black','gray','light_gray','dark_gray','anthracite','graphite',
          'silver','red','dark_red','burgundy','cherry','crimson','brick','pink',
          'fuchsia','purple','orange','coral','terracotta','yellow','gold','mustard',
          'beige','cream','milk','sand','brown','chocolate','copper','khaki','olive',
          'green','dark_green','emerald','lime','salad','mint','sea_green','turquoise',
          'cyan','sky_blue','light_blue','blue','dark_blue','cornflower','indigo',
          'violet','lilac','lavender'
        )
        AND id NOT IN (
          SELECT option_id FROM nomenclature_variant_options
        )
        AND id NOT IN (
          SELECT option_id FROM nomenclature_characteristic_value_options
        )
        """
    )
