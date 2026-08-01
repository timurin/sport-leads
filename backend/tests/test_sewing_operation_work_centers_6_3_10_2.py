"""Stage 6.3.10.2 — sewing_operation ↔ work_center link table metadata."""

from __future__ import annotations

from app.database.base import Base
from app.models.sewing_operation import SewingOperation, sewing_operation_work_centers
from app.models.shop_routing import WorkCenter  # noqa: F401


def test_sewing_operation_work_centers_table_registered() -> None:
    assert sewing_operation_work_centers.name == "sewing_operation_work_centers"
    assert "sewing_operation_work_centers" in Base.metadata.tables
    cols = {column.name for column in sewing_operation_work_centers.columns}
    assert cols == {"sewing_operation_id", "work_center_id"}


def test_sewing_operation_exposes_work_centers_relationship() -> None:
    assert "work_centers" in SewingOperation.__mapper__.relationships
    rel = SewingOperation.__mapper__.relationships["work_centers"]
    assert rel.secondary is sewing_operation_work_centers
