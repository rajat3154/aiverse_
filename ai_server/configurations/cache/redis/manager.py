
from redis.asyncio import Redis, ConnectionPool
from redis.exceptions import RedisError
from aiverse_logging import get_logger, log_event
from configurations.messages import get_message
from configurations.cache.redis.redis import get_redis_settings,validate_redis_settings

log = get_logger("aiverse.ai_server.redis")
DOMAIN = "STORAGE"


def _log(level, key, action, outcome, *args, exc_info=False):
    log_event(log, level, get_message(key, *args), domain=DOMAIN, action=action, outcome=outcome, exc_info=exc_info)

class RedisManager:
    def __init__(self):
        self.client: Redis | None = None
        self.pool: ConnectionPool | None = None
        self.enabled = False
        self.settings = get_redis_settings()
    async def connect(self) -> bool:
        if not self.settings.enabled:
            _log("INFO", "redis.connect.disabled", "CONNECT", "COMPLETED")
            return False
        try:
            validate_redis_settings(self.settings)
            self.pool = ConnectionPool.from_url(
                self.settings.url,
                max_connections=self.settings.max_connections,
                socket_timeout=self.settings.socket_timeout,
                socket_connect_timeout=self.settings.socket_connect_timeout,
                health_check_interval=self.settings.health_check_interval,
                decode_responses=True,
            )
            self.client = Redis(connection_pool=self.pool)
            await self.client.ping()
            self.enabled = True
            _log("INFO", "redis.connect.established", "CONNECT", "COMPLETED")
            return True
        except Exception as error:
            self.enabled = False
            await self.close()
            _log("ERROR", "redis.connect.failed", "CONNECT", "FAILURE", error, exc_info=True)
            return False

    async def health(self) -> bool:
        if not self.enabled or self.client is None:
            return False
        try:
            return bool(await self.client.ping())
        except RedisError as error:
            _log("WARNING", "redis.health.failed", "HEALTH", "FAILURE", error)
            return False

    def key(self, name: str) -> str:
        if not name:
            raise ValueError(get_message("redis.key.empty"))
        return f"{self.settings.key_prefix}{name.lstrip(':')}"

    async def close(self):
        if self.client is not None:
            await self.client.aclose()
            self.client = None

        if self.pool is not None:
            await self.pool.aclose()
            self.pool = None

        self.enabled = False

redis_manager = RedisManager()
