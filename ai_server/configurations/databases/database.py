import os
from dotenv import load_dotenv
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from aiverse_logging import get_logger, log_event
from configurations.messages import get_message

load_dotenv()

log = get_logger("aiverse.ai_server.database")

DOMAIN = "DATABASE"


def _log(level, key, action, outcome, *args, exc_info=False):
    log_event(log, level, get_message(key, *args), domain=DOMAIN, action=action, outcome=outcome, exc_info=exc_info)


DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    _log("ERROR", "database.config.url.missing", "CONFIG", "FAILURE")
    raise RuntimeError(get_message("database.config.url.missing"))

_log("DEBUG", "database.config.driver.rewrite", "CONFIG", "STARTED")
DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

_log("INFO", "database.config.engine.creating", "CONFIG", "STARTED")
engine: AsyncEngine = create_async_engine(DATABASE_URL, echo=False, pool_pre_ping=True, pool_size=10, max_overflow=20)
_log("DEBUG", "database.config.session.creating", "CONFIG", "STARTED")
AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False, autoflush=False, autocommit=False)
_log("INFO", "database.config.ready", "CONFIG", "COMPLETED")


async def get_db():
    _log("DEBUG", "database.session.opened", "GET_DB", "STARTED")
    async with AsyncSessionLocal() as db:
        try:
            _log("DEBUG", "database.session.yielded", "GET_DB", "STARTED")
            yield db
            _log("DEBUG", "database.session.completed", "GET_DB", "COMPLETED")
        except Exception as error:
            _log("ERROR", "database.session.failed", "GET_DB", "FAILURE", error, exc_info=True)
            await db.rollback()
            raise
        finally:
            _log("DEBUG", "database.session.closed", "GET_DB", "COMPLETED")
            await db.close()


async def init_database():
    _log("INFO", "database.init.started", "INIT_DATABASE", "STARTED")
    try:
        _log("DEBUG", "database.init.connecting", "INIT_DATABASE", "STARTED")
        async with engine.connect() as connection:
            _log("DEBUG", "database.init.healthcheck", "INIT_DATABASE", "STARTED")
            await connection.execute(text("SELECT 1"))
        _log("INFO", "database.init.completed", "INIT_DATABASE", "COMPLETED")
    except Exception as exc:
        _log("ERROR", "database.init.failed", "INIT_DATABASE", "FAILURE", type(exc).__name__, exc, exc_info=True)
        raise


async def close_database():
    _log("INFO", "database.close.started", "CLOSE_DATABASE", "STARTED")
    try:
        await engine.dispose()
        _log("INFO", "database.close.completed", "CLOSE_DATABASE", "COMPLETED")
    except Exception as error:
        _log("ERROR", "database.close.failed", "CLOSE_DATABASE", "FAILURE", error, exc_info=True)
        raise
