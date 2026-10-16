"""Read-only adapter over production diagnostics and saved-plan readiness.

This contract also gates card release. It neither schedules nor starts operations.
"""
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.sales import SalesOrder
from app.models.technical_card import TechnicalCard, TechnicalCardUnitLine
from app.schemas.production_diagnostics import ProductionDiagnostic
from app.schemas.technical_card_readiness import ReadinessIssue, ReadinessStep, TechnicalCardReadiness
from app.services.production_diagnostics import card_diagnostics
from app.services.production_state import state_for

STEPS = (
    ("basic", "Основные данные"),
    ("model", "Модель изделия"),
    ("route", "Маршрут производства"),
    ("personalization", "Персонализация"),
    ("norms", "Производственные нормы"),
    ("planning", "Производственный план"),
    ("launch", "Запуск техкарты"),
)

# These describe a prospective recalculation, not validity of a saved plan.
FORECAST_CODES = {"plan_locked", "120_day_horizon_exhausted", "standalone_active_card_required"}


def diagnostic_step(issue: ProductionDiagnostic) -> str:
    """Route original evidence to exactly one manager step; unknown blockers stay visible."""
    if issue.field in {"product_model_id", "assembly_variant_id"}:
        return "model"
    if issue.code == "invalid_quantity":
        return "basic"
    if (issue.code.startswith(("route_", "variant_", "invalid_variant", "missing_route", "active_route"))
            or issue.code == "production_route_required"):
        return "route"
    if (issue.code.startswith(("calendar_", "started_step_", "plan_", "cannot_start_"))
            or issue.code in FORECAST_CODES
            or issue.code in {"quantity_planning_start_shipping_required", "locked_assignment_conflict"}):
        return "planning"
    if issue.code == "production_state_projection_mismatch":
        return "launch"
    return "norms"


def manager_issue(issue: ProductionDiagnostic, step: str, card_id: int) -> ReadinessIssue:
    """Codes/raw trace are Debug evidence, never the only manager-facing explanation."""
    messages = {
        "basic": ("Проверьте основные данные техкарты.", "Уточните количество и данные заказа."),
        "model": ("Модель или сборка изделия не готовы к производству.", "Проверьте модель и выбранную сборку."),
        "route": ("Маршрут производства требует проверки.", "Проверьте маршрут и выбранные варианты операций."),
        "norms": (f"Для операции «{issue.entity_name or 'Операция'}» не заполнены или некорректны данные расчёта.",
                  "Заполните требуемые нормы и данные операции."),
        "planning": ("Производственный план требует проверки или пересчёта.", "Проверьте даты и пересчитайте производственный план."),
        "launch": ("Состояние техкарты требует проверки перед запуском.", "Проверьте производственные данные техкарты."),
    }
    message, action = messages[step]
    if issue.code == "variant_not_selected":
        message, action = "Не выбран вариант производственной операции.", "Выберите вариант операции в маршруте."
    if issue.code in {"missing_operator_norm", "missing_fixed_norm", "missing_sewing_norm", "missing_cutting_rate"}:
        message = f"Для операции «{issue.entity_name or 'Операция'}» не заполнена норма."
        action = "Заполните требуемую норму операции или модели."
    if issue.code == "missing_linear_meters":
        message, action = "Не указан метраж для производственной операции.", "Заполните метраж операции техкарты."
    # The card route is canonical and safe even when a source diagnostic URL is not.
    return ReadinessIssue(code=issue.code, severity=issue.severity, message=message,
                          fix_action=action, fix_url=f"/production/tech-cards/{card_id}", diagnostic=issue)


def read_readiness(db: Session, card_id: int) -> TechnicalCardReadiness:
    """One card only, no autoflush/read repair, no production command or lock."""
    from app.services.technical_cards import TechnicalCardNotFoundError

    with db.no_autoflush:
        card = db.get(TechnicalCard, card_id)
        if card is None:
            raise TechnicalCardNotFoundError("Technical card not found")
        diagnostics = card_diagnostics(db, card_id)
        state = state_for(card)
        lifecycle = state.lifecycle_status
        calendar_scope = card.order_group_id is not None and card.sales_order_id is None
        buckets: dict[str, list[ReadinessIssue]] = {code: [] for code, _ in STEPS}

        def add(step: str, code: str, message: str, action: str | None, *, severity: str = "error") -> None:
            buckets[step].append(ReadinessIssue(code=code, message=message, fix_action=action,
                                               severity=severity, fix_url=f"/production/tech-cards/{card.id}" if action else None))

        for issue in diagnostics.diagnostics:
            if issue.code == "standalone_active_card_required":
                continue  # Scheduler contour/lifecycle is handled explicitly below.
            if (not calendar_scope and issue.code == "missing_route"
                    and card.routing_template_id is not None and card.stage_results):
                continue  # A workshop-only route is not a standalone Demand route.
            step = diagnostic_step(issue)
            if not calendar_scope and step in {"norms", "planning"} and issue.category != "INTEGRITY":
                continue  # These Demand/Scheduler inputs are not execution requirements in contour A.
            adapted = manager_issue(issue, step, card_id)
            if issue.code in FORECAST_CODES and (not calendar_scope or state.planning_state == "planned"):
                adapted = adapted.model_copy(update={"severity": "warning"})
            buckets[step].append(adapted)

        if not card.number or not card.number.strip():
            add("basic", "number_required", "Не указан номер техкарты.", "Укажите номер техкарты.")
        if card.quantity is None or card.quantity <= 0:
            if not any(issue.code == "invalid_quantity" for issue in buckets["basic"]):
                add("basic", "invalid_quantity", "Количество изделий должно быть больше нуля.", "Укажите количество изделий.")
        order = db.get(SalesOrder, card.sales_order_id) if card.sales_order_id is not None else None
        order_number = card.order_group.order_number if card.order_group is not None else order.number if order else None
        if not order_number or not order_number.strip():
            add("basic", "order_number_required", "Не указан номер заказа.", "Укажите заказ техкарты.")
        if card.product_model_id is None:
            add("model", "model_required", "Модель изделия не выбрана.", "Выберите модель изделия.")
        if (calendar_scope and card.assembly_variant_id is None
                and any(issue.code == "missing_sewing_norm" for issue in diagnostics.diagnostics)):
            add("model", "assembly_required", "Для пошива не выбрана сборка с производственными нормами.",
                "Выберите сборку изделия и проверьте нормы пошива.")
        if card.routing_template_id is None or not card.stage_results:
            add("route", "route_required", "Маршрут производства не выбран.", "Выберите маршрут производства.")

        count = db.scalar(select(func.count()).select_from(TechnicalCardUnitLine).where(
            TechnicalCardUnitLine.technical_card_id == card.id)) or 0
        if card.quantity is not None and Decimal(count) != card.quantity:
            quantity = format(card.quantity.normalize(), "f")
            remaining = card.quantity - Decimal(count)
            action = (f"Добавьте недостающие изделия ({format(remaining.normalize(), 'f')} шт.) или скорректируйте персонализацию."
                      if remaining > 0 else "Скорректируйте персонализацию под количество изделий техкарты.")
            add("personalization", "personalization_quantity_mismatch",
                f"Персонализация заполнена на {count} из {quantity} изделий.", action, severity="warning")

        if calendar_scope and lifecycle != "completed":
            if card.planning_start_date is None or card.shipping_date is None:
                add("planning", "planning_dates_required", "Не заполнены даты планирования и отгрузки.",
                    "Укажите дату начала планирования и дату отгрузки.")
            if state.planning_state != "planned":
                missing = state.planning_state in {"unplanned", "partial"}
                add("planning", "saved_plan_required" if missing else "saved_plan_requires_review",
                    "Производственный план ещё не рассчитан." if missing else "Сохранённый производственный план требует проверки или пересчёта.",
                    "Рассчитайте производственный план." if missing else "Пересчитайте производственный план.")

        lifecycle_message = {
            "completed": "Производство завершено. Повторный запуск не требуется.",
            "in_progress": "Техкарта уже в производстве. Повторный запуск не требуется.",
        }.get(lifecycle)
        if lifecycle == "cancelled":
            add("launch", "launch_not_available", "Техкарта отменена. Запуск недоступен.", None)
        upstream_blocked = any(issue.severity == "error" for code, issues in buckets.items()
                               if code != "launch" for issue in issues)
        if upstream_blocked and lifecycle not in {"completed", "in_progress"}:
            add("launch", "readiness_incomplete", "Перед запуском устраните блокирующие замечания.",
                "Заполните обязательные данные техкарты.")

        steps = []
        for code, title in STEPS:
            issues = buckets[code]
            blocking = any(issue.severity == "error" for issue in issues)
            status = "blocked" if blocking else "warning" if issues else "completed"
            if lifecycle == "completed" and not blocking:
                status = "completed"
            primary = next((issue for issue in issues if issue.severity == "error"), next(iter(issues), None))
            if code == "launch":
                primary = next((issue for issue in issues if issue.code == "launch_not_available"), primary)
            summary = primary.message if primary else ("Техкарта готова к запуску; операции остаются в ожидании."
                                                       if code == "launch" else "Данные заполнены и проверены.")
            if code == "planning" and primary is None:
                ends = [row.planned_end for row in diagnostics.calendar_assignments if row.snapshot_node_id is not None]
                summary = (f"Производственный план рассчитан. Завершение: {max(ends).isoformat()}."
                           if calendar_scope and ends else "Для этой техкарты отдельный календарный план не требуется.")
            if code == "launch" and lifecycle_message is not None:
                summary = lifecycle_message
            steps.append(ReadinessStep(code=code, title=title, status=status, summary=summary, issues=issues,
                                       blocking=blocking,
                                       fix_action=None if primary is None or (code == "launch" and lifecycle_message) else primary.fix_action,
                                       fix_url=None if primary is None or (code == "launch" and lifecycle_message) else primary.fix_url))
        blocked = any(step.blocking for step in steps)
        warning = any(step.status == "warning" for step in steps)
        return TechnicalCardReadiness(technical_card_id=card.id, lifecycle_status=lifecycle,
                                      overall_status="blocked" if blocked else "completed" if lifecycle == "completed" else "warning" if warning else "ready",
                                      can_launch=not blocked and lifecycle not in {"completed", "in_progress", "cancelled"},
                                      progress_completed=sum(step.status == "completed" for step in steps), steps=steps)


def assert_ready_to_launch(db: Session, card_id: int) -> None:
    from app.services.technical_cards import TechnicalCardConflictError

    readiness = read_readiness(db, card_id)
    if not readiness.can_launch:
        if any(issue.code == "saved_plan_required" for step in readiness.steps for issue in step.issues):
            from app.services.calendar_plan_lifecycle import CannotStartWithoutSavedPlan
            raise CannotStartWithoutSavedPlan()
        step = next((step for step in readiness.steps if step.blocking), readiness.steps[-1])
        raise TechnicalCardConflictError(step.summary)
