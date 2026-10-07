"""PC-03.5A: persistent automatic calendar entry stage; existing queues untouched."""
import sqlalchemy as sa
from alembic import op

revision = "w2x3y4z5a678"
down_revision = "v1w2x3y4z567"
branch_labels = None
depends_on = None

CODE = "launch_preparation"
NAME = "Подготовка к запуску"


def upgrade() -> None:
    bind = op.get_bind()
    conflict = bind.execute(sa.text("SELECT id FROM production_stages WHERE code=:code OR name=:name"), {"code": CODE, "name": NAME}).first()
    if conflict is not None:
        raise RuntimeError("Entry stage code/name already exists; migration will not overwrite an owner stage")
    bind.execute(sa.text("INSERT INTO production_stages (name, code, is_active, sort_order) VALUES (:name, :code, true, 0)"),
                 {"name": NAME, "code": CODE})


def downgrade() -> None:
    bind = op.get_bind()
    row = bind.execute(sa.text("SELECT id, name, is_active, sort_order FROM production_stages WHERE code=:code"), {"code": CODE}).first()
    if row is None:
        return
    if row.name != NAME or not row.is_active or row.sort_order != 0:
        raise RuntimeError("Entry stage was modified; downgrade will not delete owner data")
    # SET NULL / CASCADE references are guarded too: rollback must not silently alter user links.
    inspector = sa.inspect(bind)
    for table_name in inspector.get_table_names():
        for fk in inspector.get_foreign_keys(table_name):
            if fk["referred_table"] != "production_stages":
                continue
            table = sa.table(table_name, *(sa.column(column) for column in fk["constrained_columns"]))
            for column in fk["constrained_columns"]:
                if bind.execute(sa.select(sa.literal(1)).select_from(table).where(table.c[column] == row.id).limit(1)).first():
                    raise RuntimeError("Entry stage is in use; downgrade will not delete assignments or resource links")
    bind.execute(sa.text("DELETE FROM production_stages WHERE id=:id"), {"id": row.id})
