import os

from dotenv import load_dotenv


load_dotenv()


def get_required_env(name: str) -> str:
    value = os.getenv(name)

    if value is None or not value.strip():
        raise RuntimeError(
            f"Обязательная переменная окружения {name} не задана"
        )

    return value


class Settings:
    postgres_host: str = os.getenv(
        "POSTGRES_HOST",
        "localhost",
    )

    postgres_port: int = int(
        os.getenv(
            "POSTGRES_PORT",
            "5432",
        )
    )

    postgres_db: str = os.getenv(
        "POSTGRES_DB",
        "sport_leads",
    )

    postgres_user: str = os.getenv(
        "POSTGRES_USER",
        "sport_leads",
    )

    postgres_password: str = get_required_env(
        "POSTGRES_PASSWORD"
    )

    log_level: str = os.getenv(
        "LOG_LEVEL",
        "INFO",
    )

    log_format: str = os.getenv(
        "LOG_FORMAT",
        "text",
    )

    # Auth session (ADR-023 / 17.1.1.2)
    auth_session_ttl_hours: int = int(os.getenv("AUTH_SESSION_TTL_HOURS", "12"))
    auth_session_max_hours: int = int(os.getenv("AUTH_SESSION_MAX_HOURS", "24"))
    auth_cookie_secure: bool = (
        os.getenv("AUTH_COOKIE_SECURE", "false").strip().lower()
        in {"1", "true", "yes", "on"}
    )
    auth_cookie_samesite: str = os.getenv("AUTH_COOKIE_SAMESITE", "lax").strip().lower()
    auth_bootstrap_login: str | None = os.getenv("AUTH_BOOTSTRAP_LOGIN")
    auth_bootstrap_password: str | None = os.getenv("AUTH_BOOTSTRAP_PASSWORD")
    auth_bootstrap_display_name: str | None = os.getenv(
        "AUTH_BOOTSTRAP_DISPLAY_NAME"
    )
    cors_origins: list[str] = [
        item.strip()
        for item in os.getenv(
            "SPORT_LEADS_CORS_ORIGINS",
            "http://127.0.0.1:3001,http://localhost:3001",
        ).split(",")
        if item.strip()
    ]

    @property
    def database_url(self) -> str:
        explicit_database_url = os.getenv(
            "DATABASE_URL"
        )

        if explicit_database_url:
            return explicit_database_url

        return (
            "postgresql+psycopg2://"
            f"{self.postgres_user}:"
            f"{self.postgres_password}@"
            f"{self.postgres_host}:"
            f"{self.postgres_port}/"
            f"{self.postgres_db}"
        )


settings = Settings()