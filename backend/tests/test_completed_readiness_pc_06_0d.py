from sqlalchemy import event

from tests.test_production_scheduler_pc_04_3a import scheduler, run
from tests.test_technical_card_readiness_pc_06_0a import prepare, step
from app.models.technical_card import TechnicalCard
from app.services.technical_card_readiness import read_readiness
from app.services.technical_card_stages import start_stage, complete_stage, start_technical_card
from app.services.technical_cards import TechnicalCardConflictError
import pytest


def finish(factory):
    with factory() as db:
        start_stage(db, 1, 1)
        complete_stage(db, 1, 1)


@pytest.mark.parametrize("personalized", [4, 1])
def test_completed_is_final_seven_of_seven_without_false_launch_blocker(scheduler, personalized):
    factory, engine = scheduler
    prepare(factory, personalized=personalized)
    run(factory)
    finish(factory)
    writes = []
    def observe(connection, cursor, sql, *args):
        if sql.lstrip().upper().startswith(("INSERT", "UPDATE", "DELETE")):
            writes.append(sql)
    event.listen(engine, "before_cursor_execute", observe)
    try:
        with factory() as db:
            result = read_readiness(db, 1)
            assert result.overall_status == "completed"
            assert result.progress_completed == result.progress_total == 7
            assert not result.can_launch and not any(row.blocking for row in result.steps)
            launch = step(result, "launch")
            assert launch.status == "completed" and not launch.issues
            assert launch.summary == "Производство завершено. Повторный запуск не требуется."
            assert launch.fix_action is None and launch.fix_url is None
            with pytest.raises(TechnicalCardConflictError):
                start_technical_card(db, 1)
        assert not writes
    finally:
        event.remove(engine, "before_cursor_execute", observe)


def test_in_progress_readiness_is_not_blocked_by_action_availability(scheduler):
    factory, _ = scheduler
    prepare(factory)
    run(factory)
    with factory() as db:
        start_stage(db, 1, 1)
        result = read_readiness(db, 1)
        assert not result.can_launch
        assert result.overall_status == "ready"
        assert not any(row.blocking for row in result.steps)
        assert step(result, "launch").status == "completed"
        assert not step(result, "launch").issues
        with pytest.raises(TechnicalCardConflictError, match="Повторный запуск не требуется"):
            start_technical_card(db, 1)


def test_real_completed_configuration_error_is_not_hidden(scheduler):
    factory, _ = scheduler
    prepare(factory)
    run(factory)
    finish(factory)
    with factory() as db:
        db.get(TechnicalCard, 1).product_model_id = None
        db.commit()
        result = read_readiness(db, 1)
        assert result.overall_status == "blocked" and not result.can_launch
        assert step(result, "model").blocking
        assert step(result, "launch").status == "completed"
        assert not step(result, "launch").blocking


def test_real_completed_integrity_error_is_not_hidden(scheduler):
    factory, _ = scheduler
    prepare(factory)
    run(factory)
    finish(factory)
    with factory() as db:
        card = db.get(TechnicalCard, 1)
        card.current_stage_order = 1
        card.current_stage_label = "stale cache"
        db.commit()
        result = read_readiness(db, 1)
        assert result.overall_status == "blocked"
        assert any(issue.code == "production_state_projection_mismatch" for row in result.steps for issue in row.issues)


def test_ready_and_blocked_draft_keep_launch_agreement(scheduler):
    factory, _ = scheduler
    prepare(factory)
    run(factory)
    with factory() as db:
        assert read_readiness(db, 1).can_launch
        start_technical_card(db, 1)
        db.get(TechnicalCard, 1).product_model_id = None
        db.commit()
        assert not read_readiness(db, 1).can_launch
        with pytest.raises(TechnicalCardConflictError):
            start_technical_card(db, 1)
