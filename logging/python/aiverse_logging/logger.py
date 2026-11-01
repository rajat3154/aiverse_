
import logging
import os
import sys

from .formatter import AiverseJsonFormatter
from .otel import configure_otel_logging, shutdown_otel_logging

_configured = False
_aiverse_handlers: list[logging.Handler] = []

def configure_logging(service_name: str | None = None) -> None:
    global _configured
    if _configured:
        return
    if service_name:
        os.environ["OTEL_SERVICE_NAME"] = service_name
    level_name = os.getenv("AIVERSE_LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)
    if not isinstance(level, int):
        raise ValueError(f"Invalid logging level: {level_name}")
    root = logging.getLogger()
    root.setLevel(level)
    if os.getenv("AIVERSE_LOG_CONSOLE", "true").lower() == "true":
        console = logging.StreamHandler(sys.stdout)
        console.setFormatter(AiverseJsonFormatter())
        root.addHandler(console)
        _aiverse_handlers.append(console)
    otel_handler = configure_otel_logging()
    if otel_handler:
        root.addHandler(otel_handler)
        _aiverse_handlers.append(otel_handler)
    _configured = True

def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)

def log_event(logger,level,message,*,domain,action,outcome,context=None,exc_info=False):
    if isinstance(level, str):
        normalized_level = logging.getLevelName(level.upper())
        if not isinstance(normalized_level, int):
            raise ValueError(f"Invalid logging level: {level}")
        level = normalized_level
    if not isinstance(level, int):
        raise TypeError("level must be an integer or a valid level name")
    logger.log(level,message,
        extra={
            "event_domain": domain,
            "event_action": action,
            "event_outcome": outcome,
            "aiverse_context": context or {}
        },exc_info=exc_info)

def shutdown_logging() -> None:
    global _configured
    if not _configured:
        return
    root = logging.getLogger()
    for handler in _aiverse_handlers[:]:
        root.removeHandler(handler)
    shutdown_otel_logging()
    for handler in _aiverse_handlers[:]:
        handler.close()
    _aiverse_handlers.clear()
    _configured = False
