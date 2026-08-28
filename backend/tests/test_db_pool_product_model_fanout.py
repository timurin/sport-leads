"""DB pool must cover product-model card parallel catalog GETs.

ProductModelRoute Promise.all fans out ~14 FastAPI calls. Default SQLAlchemy
QueuePool (5+10) times out with TimeoutError → GET /tech-operations 500.
"""

from sqlalchemy.pool import QueuePool

from app.config.settings import settings
from app.database.session import engine


def test_db_pool_covers_product_model_catalog_fanout() -> None:
    assert settings.db_pool_size + settings.db_max_overflow >= 40


def test_engine_uses_configured_queue_pool() -> None:
    assert isinstance(engine.pool, QueuePool)
    assert engine.pool.size() == settings.db_pool_size
    assert engine.pool._max_overflow == settings.db_max_overflow
    assert engine.pool.timeout() == settings.db_pool_timeout
