from __future__ import annotations

import logging
import sys
from typing import Literal

from loguru import logger

LogFormat = Literal["text", "json"]

_ALLOWED_LEVELS = frozenset(
    {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
)
_ALLOWED_FORMATS = frozenset({"text", "json"})


def normalize_log_level(level: str) -> str:
    normalized = level.strip().upper()

    if normalized not in _ALLOWED_LEVELS:
        raise ValueError(
            "Unsupported LOG_LEVEL "
            f"{level!r}; expected one of "
            + ", ".join(sorted(_ALLOWED_LEVELS))
        )

    return normalized


def normalize_log_format(format_name: str) -> LogFormat:
    normalized = format_name.strip().lower()

    if normalized not in _ALLOWED_FORMATS:
        raise ValueError(
            "Unsupported LOG_FORMAT "
            f"{format_name!r}; expected text or json"
        )

    return normalized  # type: ignore[return-value]


class InterceptHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = str(record.levelno)

        frame = logging.currentframe()
        depth = 2

        while (
            frame is not None
            and frame.f_code.co_filename == logging.__file__
        ):
            frame = frame.f_back
            depth += 1

        logger.opt(
            depth=depth,
            exception=record.exc_info,
        ).log(level, record.getMessage())


def configure_logging(
    *,
    level: str = "INFO",
    format_name: str = "text",
) -> None:
    log_level = normalize_log_level(level)
    log_format = normalize_log_format(format_name)

    logger.remove()

    if log_format == "json":
        logger.add(
            sys.stderr,
            level=log_level,
            serialize=True,
            enqueue=False,
            backtrace=False,
            diagnose=False,
        )
    else:
        logger.add(
            sys.stderr,
            level=log_level,
            format=(
                "{time:YYYY-MM-DD HH:mm:ss.SSS} | "
                "{level: <8} | "
                "{name}:{function}:{line} - "
                "{message}"
            ),
            enqueue=False,
            backtrace=False,
            diagnose=False,
        )

    intercept = InterceptHandler()
    logging.root.handlers = [intercept]
    logging.root.setLevel(log_level)

    for logger_name in (
        "uvicorn",
        "uvicorn.error",
        "uvicorn.access",
        "fastapi",
    ):
        std_logger = logging.getLogger(logger_name)
        std_logger.handlers = [intercept]
        std_logger.propagate = False
        std_logger.setLevel(log_level)

    logger.bind(
        component="platform",
        log_level=log_level,
        log_format=log_format,
    ).info("Application logging configured")
