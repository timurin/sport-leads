# syntax=docker/dockerfile:1

FROM python:3.13-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
        curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt \
    && playwright install --with-deps chromium

COPY backend/app /app/app
COPY backend/alembic /app/alembic
COPY backend/alembic.ini /app/alembic.ini

EXPOSE 8000

HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD curl -fsS "http://127.0.0.1:8000/health" || exit 1

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
