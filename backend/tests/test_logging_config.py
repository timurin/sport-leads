import pytest

from app.logging_config import (
    configure_logging,
    normalize_log_format,
    normalize_log_level,
)


def test_normalize_log_level_accepts_known_values() -> None:
    assert normalize_log_level("info") == "INFO"
    assert normalize_log_level("DEBUG") == "DEBUG"


def test_normalize_log_level_rejects_unknown_values() -> None:
    with pytest.raises(ValueError, match="Unsupported LOG_LEVEL"):
        normalize_log_level("verbose")


def test_normalize_log_format_accepts_text_and_json() -> None:
    assert normalize_log_format("TEXT") == "text"
    assert normalize_log_format("json") == "json"


def test_normalize_log_format_rejects_unknown_values() -> None:
    with pytest.raises(ValueError, match="Unsupported LOG_FORMAT"):
        normalize_log_format("yaml")


def test_configure_logging_text_and_json() -> None:
    configure_logging(level="INFO", format_name="text")
    configure_logging(level="WARNING", format_name="json")
