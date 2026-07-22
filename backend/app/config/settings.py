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