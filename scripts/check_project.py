from __future__ import annotations

import compileall
import os
import shutil
import subprocess
import sys
import traceback
from collections import Counter
from pathlib import Path
from typing import Callable


PROJECT_ROOT = Path(__file__).resolve().parent.parent

BACKEND_ROOT = PROJECT_ROOT / "backend"
FRONTEND_ROOT = PROJECT_ROOT / "frontend"

if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

APP_DIR = BACKEND_ROOT / "app"
ALEMBIC_DIR = BACKEND_ROOT / "alembic"
TESTS_DIR = BACKEND_ROOT / "tests"

class ProjectCheckError(RuntimeError):
    pass


def print_header(title: str) -> None:
    print()
    print("=" * 72)
    print(title)
    print("=" * 72)


def safe_print(text: str) -> None:
    if not text.strip():
        return

    encoding = getattr(sys.stdout, "encoding", None) or "utf-8"
    print(text.rstrip().encode(encoding, errors="replace").decode(encoding))


def run_command(
    command: list[str],
    *,
    cwd: Path = PROJECT_ROOT,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess[str]:
    merged_env = None
    if env is not None:
        merged_env = {**os.environ, **env}

    result = subprocess.run(
        command,
        cwd=cwd,
        text=True,
        capture_output=True,
        encoding="utf-8",
        errors="replace",
        env=merged_env,
    )

    if result.stdout.strip():
        safe_print(result.stdout)

    if result.returncode != 0:
        if result.stderr.strip():
            safe_print(result.stderr)

        raise ProjectCheckError(
            f"Команда завершилась с кодом "
            f"{result.returncode}: {' '.join(command)}"
        )

    return result


def check_python_compilation() -> None:
    for directory in (
        APP_DIR,
        ALEMBIC_DIR,
        TESTS_DIR,
    ):
        success = compileall.compile_dir(
            directory,
            quiet=1,
            force=True,
        )

        if not success:
            raise ProjectCheckError(
                f"Ошибка компиляции: {directory}"
            )

    print("Python успешно скомпилирован")


def check_application_import() -> None:
    from app.main import app

    if not app.title:
        raise ProjectCheckError(
            "FastAPI-приложение не имеет title"
        )

    print(f"Приложение: {app.title}")
    print(f"Версия: {app.version}")


def check_openapi() -> None:
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
        lines = [
            f"{operation_id}: {count}"
            for operation_id, count
            in sorted(duplicates.items())
        ]

        raise ProjectCheckError(
            "Найдены дубли operationId:\n"
            + "\n".join(lines)
        )

    print(f"Маршрутов: {len(paths)}")
    print(
        f"Уникальных operationId: "
        f"{len(operation_ids)}"
    )


def check_sqlalchemy_models() -> None:
    import app.models as models_pkg
    from app.database.base import Base

    expected_tables: set[str] = set()

    for name in models_pkg.__all__:
        model = getattr(models_pkg, name)
        tablename = getattr(model, "__tablename__", None)

        if tablename:
            expected_tables.add(tablename)

    actual_tables = set(Base.metadata.tables.keys())
    missing_tables = expected_tables - actual_tables

    if missing_tables:
        raise ProjectCheckError(
            "В Base.metadata отсутствуют таблицы: "
            + ", ".join(sorted(missing_tables))
        )

    print(
        "Таблицы SQLAlchemy (модели): "
        + ", ".join(sorted(expected_tables))
    )
    print(
        "Всего таблиц в metadata: "
        f"{len(actual_tables)}"
    )


def check_collector_factory() -> None:
    from app.collectors.factory import (
        CollectorFactory,
    )
    from app.collectors.mock import MockCollector

    supported_types = (
        CollectorFactory.supported_types()
    )

    if "mock" not in supported_types:
        raise ProjectCheckError(
            "Тип mock не зарегистрирован"
        )

    collector = CollectorFactory.create(
        " MOCK "
    )

    if not isinstance(collector, MockCollector):
        raise ProjectCheckError(
            "Фабрика вернула неверный коллектор"
        )

    print(
        "Типы источников: "
        + ", ".join(supported_types)
    )


def check_mock_collector() -> None:
    from app.collectors.factory import (
        CollectorFactory,
    )
    from app.models.source import Source

    source = Source(
        id=1,
        name="Project check",
        url="https://example.com/check",
        source_type="mock",
        sport="Все",
        city="Все",
        use_browser=False,
        ignore_https_errors=False,
        is_active=True,
    )

    result = CollectorFactory.create(
        source.source_type
    ).collect(source)

    if result.items_found != 2:
        raise ProjectCheckError(
            "MockCollector должен вернуть 2 записи. "
            f"Получено: {result.items_found}"
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

    for number, item in enumerate(
        result.items,
        start=1,
    ):
        missing_fields = (
            required_fields - set(item)
        )

        if missing_fields:
            raise ProjectCheckError(
                f"Запись {number} не содержит поля: "
                + ", ".join(sorted(missing_fields))
            )

    print(
        f"MockCollector вернул записей: "
        f"{result.items_found}"
    )


def check_alembic() -> None:
    run_command(
        [
            sys.executable,
            "-m",
            "alembic",
            "check",
        ],
        cwd=BACKEND_ROOT,
    )


def check_pytest() -> None:
    pythonpath_parts = [str(PROJECT_ROOT), str(BACKEND_ROOT)]
    existing = os.environ.get("PYTHONPATH", "")
    if existing:
        pythonpath_parts.append(existing)

    run_command(
        [
            sys.executable,
            "-m",
            "pytest",
            "-q",
        ],
        cwd=BACKEND_ROOT,
        env={"PYTHONPATH": os.pathsep.join(pythonpath_parts)},
    )

    print("Backend pytest успешно пройден")


def check_frontend() -> None:
    package_json = FRONTEND_ROOT / "package.json"

    if not package_json.exists():
        raise ProjectCheckError(
            "frontend/package.json не найден"
        )

    npm_command = (
        shutil.which("npm.cmd")
        or shutil.which("npm")
    )

    if npm_command is None:
        raise ProjectCheckError(
            "npm не найден в PATH"
        )

    run_command(
        [
            npm_command,
            "run",
            "lint",
        ],
        cwd=FRONTEND_ROOT,
    )

    npx_command = (
        shutil.which("npx.cmd")
        or shutil.which("npx")
    )

    if npx_command is None:
        raise ProjectCheckError(
            "npx не найден в PATH"
        )

    run_command(
        [
            npx_command,
            "tsc",
            "--noEmit",
        ],
        cwd=FRONTEND_ROOT,
    )

    run_command(
        [
            npm_command,
            "run",
            "test",
        ],
        cwd=FRONTEND_ROOT,
    )

    run_command(
        [
            npm_command,
            "run",
            "build",
        ],
        cwd=FRONTEND_ROOT,
    )

    print("Frontend успешно проверен")

def check_docker_compose() -> None:
    compose_file = PROJECT_ROOT / "compose.yaml"

    if not compose_file.exists():
        raise ProjectCheckError(
            "Файл compose.yaml не найден"
        )

    run_command(
        [
            "docker",
            "compose",
            "-f",
            str(compose_file),
            "config",
            "--quiet",
        ]
    )

    print("compose.yaml корректен")


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
            "1. Компиляция Python",
            check_python_compilation,
        ),
        (
            "2. Импорт FastAPI",
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
            check_mock_collector,
        ),
        (
            "7. Проверка Alembic",
            check_alembic,
        ),
        (
            "8. Backend pytest",
            check_pytest,
        ),
        (
            "9. Проверка frontend",
            check_frontend,
        ),
        (
            "10. Проверка Docker Compose",
            check_docker_compose,
        ),
    ]

    results = [
        run_check(name, check)
        for name, check in checks
    ]

    passed = sum(results)
    total = len(results)
    failed = total - passed

    print_header("ИТОГ")

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
