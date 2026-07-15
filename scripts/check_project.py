from __future__ import annotations

import compileall
import sys
import traceback
from collections import Counter
from pathlib import Path
from typing import Callable


PROJECT_ROOT = Path(__file__).resolve().parent.parent
APP_DIRECTORY = PROJECT_ROOT / "app"


class ProjectCheckError(RuntimeError):
    """
    Ошибка автоматической проверки проекта.
    """


def print_header(title: str) -> None:
    print()
    print("=" * 70)
    print(title)
    print("=" * 70)


def check_python_compilation() -> None:
    """
    Компилирует все Python-файлы приложения.
    """

    success = compileall.compile_dir(
        APP_DIRECTORY,
        quiet=1,
        force=True,
    )

    if not success:
        raise ProjectCheckError(
            "Обнаружены ошибки синтаксиса Python"
        )


def check_application_import() -> None:
    """
    Проверяет загрузку FastAPI-приложения.
    """

    from app.main import app

    if not app.title:
        raise ProjectCheckError(
            "FastAPI-приложение не имеет title"
        )

    print(f"FastAPI: {app.title}")
    print(f"Версия: {app.version}")


def check_openapi() -> None:
    """
    Проверяет генерацию OpenAPI и дубли operationId.
    """

    from app.main import app

    schema = app.openapi()
    paths = schema.get("paths", {})

    if not paths:
        raise ProjectCheckError(
            "В OpenAPI отсутствуют маршруты"
        )

    operation_ids: list[str] = []

    for path_data in paths.values():
        for operation_data in path_data.values():
            if not isinstance(operation_data, dict):
                continue

            operation_id = operation_data.get(
                "operationId"
            )

            if operation_id:
                operation_ids.append(operation_id)

    duplicates = {
        operation_id: count
        for operation_id, count
        in Counter(operation_ids).items()
        if count > 1
    }

    if duplicates:
        duplicate_lines = [
            f"{operation_id}: {count}"
            for operation_id, count in duplicates.items()
        ]

        raise ProjectCheckError(
            "Найдены дубли operationId:\n"
            + "\n".join(duplicate_lines)
        )

    print(f"Маршрутов OpenAPI: {len(paths)}")
    print(
        f"Уникальных operationId: "
        f"{len(operation_ids)}"
    )


def check_sqlalchemy_models() -> None:
    """
    Проверяет регистрацию основных моделей SQLAlchemy.
    """

    from app.database.base import Base
    from app.models.import_run import ImportRun
    from app.models.source import Source
    from app.models.sport_event import SportEvent

    expected_tables = {
        Source.__tablename__,
        SportEvent.__tablename__,
        ImportRun.__tablename__,
    }

    registered_tables = set(
        Base.metadata.tables.keys()
    )

    missing_tables = (
        expected_tables - registered_tables
    )

    if missing_tables:
        raise ProjectCheckError(
            "В Base.metadata отсутствуют таблицы: "
            + ", ".join(sorted(missing_tables))
        )

    print(
        "Зарегистрированные таблицы: "
        + ", ".join(sorted(registered_tables))
    )


def check_collector_factory() -> None:
    """
    Проверяет фабрику коллекторов.
    """

    from app.collectors.factory import (
        CollectorFactory,
    )
    from app.collectors.mock import MockCollector

    supported_types = (
        CollectorFactory.supported_types()
    )

    if "mock" not in supported_types:
        raise ProjectCheckError(
            "Тип mock отсутствует в CollectorFactory"
        )

    collector = CollectorFactory.create(" MOCK ")

    if not isinstance(collector, MockCollector):
        raise ProjectCheckError(
            "CollectorFactory вернула неверный класс"
        )

    print(
        "Поддерживаемые типы источников: "
        + ", ".join(supported_types)
    )


def check_mock_collection() -> None:
    """
    Проверяет получение тестовых мероприятий.
    """

    from app.collectors.factory import (
        CollectorFactory,
    )
    from app.models.source import Source

    source = Source(
        id=1,
        name="Автоматическая проверка",
        url="https://example.com/check",
        source_type="mock",
        sport="Все",
        city="Все",
        use_browser=False,
        ignore_https_errors=False,
        is_active=True,
    )

    collector = CollectorFactory.create(
        source.source_type
    )

    result = collector.collect(source)

    if result.items_found != 2:
        raise ProjectCheckError(
            "MockCollector должен вернуть 2 записи, "
            f"получено: {result.items_found}"
        )

    required_fields = {
        "external_id",
        "title",
        "sport",
        "city",
        "country",
        "source_name",
        "source_url",
    }

    for index, item in enumerate(
        result.items,
        start=1,
    ):
        missing_fields = (
            required_fields - set(item)
        )

        if missing_fields:
            raise ProjectCheckError(
                f"В записи {index} отсутствуют поля: "
                + ", ".join(sorted(missing_fields))
            )

    print(
        f"MockCollector вернул записей: "
        f"{result.items_found}"
    )


def run_check(
    name: str,
    check: Callable[[], None],
) -> bool:
    print_header(name)

    try:
        check()
    except Exception:
        print("Результат: FAILED")
        traceback.print_exc()
        return False

    print("Результат: OK")
    return True


def main() -> int:
    checks: list[
        tuple[str, Callable[[], None]]
    ] = [
        (
            "1. Компиляция Python-файлов",
            check_python_compilation,
        ),
        (
            "2. Импорт FastAPI-приложения",
            check_application_import,
        ),
        (
            "3. Проверка OpenAPI",
            check_openapi,
        ),
        (
            "4. Проверка моделей SQLAlchemy",
            check_sqlalchemy_models,
        ),
        (
            "5. Проверка CollectorFactory",
            check_collector_factory,
        ),
        (
            "6. Проверка MockCollector",
            check_mock_collection,
        ),
    ]

    results = [
        run_check(name, check)
        for name, check in checks
    ]

    print_header("ИТОГ")

    passed = sum(results)
    total = len(results)
    failed = total - passed

    print(f"Успешно: {passed}")
    print(f"Ошибок: {failed}")
    print(f"Всего проверок: {total}")

    if failed:
        print()
        print("PROJECT CHECK FAILED")
        return 1

    print()
    print("PROJECT CHECK PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())