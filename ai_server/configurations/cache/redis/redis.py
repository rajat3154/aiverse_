
import os
from dataclasses import dataclass
from urllib.parse import urlparse

from configurations.messages import get_message

@dataclass(frozen=True)
class RedisSettings:
    enabled: bool
    url: str
    max_connections: int
    socket_timeout: float
    socket_connect_timeout: float
    health_check_interval: int
    key_prefix: str

def get_redis_settings() -> RedisSettings:
    return RedisSettings(
        enabled=os.getenv("REDIS_ENABLED", "true").lower() == "true",
        url=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
        max_connections=int(os.getenv("REDIS_MAX_CONNECTIONS", "20")),
        socket_timeout=float(os.getenv("REDIS_SOCKET_TIMEOUT", "5")),
        socket_connect_timeout=float(os.getenv("REDIS_SOCKET_CONNECT_TIMEOUT", "5")),
        health_check_interval=int(os.getenv("REDIS_HEALTH_CHECK_INTERVAL", "30")),
        key_prefix=os.getenv("REDIS_KEY_PREFIX", "aiverse:ai").rstrip(":") + ":",
    )

def validate_redis_settings(settings: RedisSettings) -> None:
    if settings.max_connections < 1:
        raise ValueError(get_message("redis.settings.max_connections.invalid"))
    parsed = urlparse(settings.url)
    if parsed.scheme not in ("redis", "rediss"):
        raise ValueError(get_message("redis.settings.url.invalid"))
