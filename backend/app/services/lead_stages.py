from __future__ import annotations

from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sales import Lead, LeadEvent, LeadEventType, LeadStage, LeadStatus
from app.schemas.sales import LeadStageConfigurationUpdate


DEFAULT_LEAD_STAGES = (
    ("new", "Новый", "bg-blue-500"),
    ("contact", "Первичный контакт", "bg-cyan-500"),
    ("qualification", "Квалификация", "bg-violet-500"),
    ("proposal", "Предложение", "bg-amber-500"),
    ("waiting", "Ожидание решения", "bg-orange-500"),
)
SYSTEM_STAGE_IDS = frozenset(stage_id for stage_id, _, _ in DEFAULT_LEAD_STAGES)
RESERVED_STAGE_IDS = frozenset({LeadStatus.COMPLETED.value, "converted", "rejected"})
ALLOWED_ACCENT_CLASSES = frozenset(
    {
        "bg-blue-500",
        "bg-cyan-500",
        "bg-violet-500",
        "bg-amber-500",
        "bg-orange-500",
        "bg-emerald-500",
        "bg-rose-500",
        "bg-slate-500",
    }
)


class LeadStageError(RuntimeError):
    pass


class LeadStageNotFoundError(LeadStageError):
    pass


class LeadStageConflictError(LeadStageError):
    pass


def ensure_default_lead_stages(db: Session) -> None:
    existing_ids = set(db.scalars(select(LeadStage.id)).all())
    for sort_order, (stage_id, title, accent_class) in enumerate(DEFAULT_LEAD_STAGES):
        if stage_id not in existing_ids:
            db.add(
                LeadStage(
                    id=stage_id,
                    title=title,
                    accent_class=accent_class,
                    is_active=True,
                    sort_order=sort_order,
                    is_system=True,
                )
            )
    if not SYSTEM_STAGE_IDS.issubset(existing_ids):
        db.flush()


def list_lead_stages(db: Session) -> list[LeadStage]:
    ensure_default_lead_stages(db)
    return list(db.scalars(select(LeadStage).order_by(LeadStage.sort_order, LeadStage.id)).all())


def change_lead_stage(db: Session, lead: Lead, stage_id: str) -> None:
    ensure_default_lead_stages(db)
    if lead.status == LeadStatus.COMPLETED.value:
        raise LeadStageConflictError("Completed leads cannot be changed")
    stage = db.get(LeadStage, stage_id)
    if stage is None:
        raise LeadStageNotFoundError("Lead stage not found")
    if not stage.is_active:
        raise LeadStageConflictError("Lead stage is inactive")
    if lead.status == stage.id:
        return

    previous_stage = lead.status
    lead.status = stage.id
    db.add(
        LeadEvent(
            lead_id=lead.id,
            event_type=LeadEventType.LEAD_STATUS_CHANGED,
            message=f"Status changed from {previous_stage} to {stage.id}",
        )
    )


def _leads_in_stages(db: Session, stage_ids: Iterable[str]) -> list[Lead]:
    ids = tuple(stage_ids)
    if not ids:
        return []
    return list(db.scalars(select(Lead).where(Lead.status.in_(ids)).with_for_update()).all())


def configure_lead_stages(
    db: Session,
    payload: LeadStageConfigurationUpdate,
) -> list[LeadStage]:
    ensure_default_lead_stages(db)
    current = {
        stage.id: stage
        for stage in db.scalars(select(LeadStage).with_for_update()).all()
    }
    requested = {stage.id: stage for stage in payload.stages}

    if not SYSTEM_STAGE_IDS.issubset(requested):
        raise LeadStageConflictError("System lead stages cannot be removed")
    if RESERVED_STAGE_IDS.intersection(requested):
        raise LeadStageConflictError("Reserved identifiers cannot be used as working stages")
    if any(stage.accent_class not in ALLOWED_ACCENT_CLASSES for stage in payload.stages):
        raise LeadStageConflictError("Unsupported lead stage accent")

    removed_ids = set(current).difference(requested)
    if any(current[stage_id].is_system for stage_id in removed_ids):
        raise LeadStageConflictError("System lead stages cannot be removed")
    inactive_ids = {stage.id for stage in payload.stages if not stage.is_active}
    affected_leads = _leads_in_stages(db, removed_ids | inactive_ids)
    active_ids = {stage.id for stage in payload.stages if stage.is_active}

    for lead in affected_leads:
        target_id = payload.transfers.get(lead.status)
        if target_id not in active_ids or target_id == lead.status:
            raise LeadStageConflictError(
                f"Active transfer stage is required for leads in '{lead.status}'"
            )
        previous_stage = lead.status
        lead.status = target_id
        db.add(
            LeadEvent(
                lead_id=lead.id,
                event_type=LeadEventType.LEAD_STATUS_CHANGED,
                message=f"Status changed from {previous_stage} to {target_id}",
            )
        )

    for stage in current.values():
        stage.sort_order += 10_000
    db.flush()

    for stage_id, values in requested.items():
        stage = current.get(stage_id)
        if stage is None:
            stage = LeadStage(id=stage_id, is_system=False)
            db.add(stage)
        stage.title = values.title
        stage.accent_class = values.accent_class
        stage.is_active = values.is_active
        stage.sort_order = values.sort_order

    for stage_id in removed_ids:
        db.delete(current[stage_id])

    db.flush()
    return list(db.scalars(select(LeadStage).order_by(LeadStage.sort_order, LeadStage.id)).all())
