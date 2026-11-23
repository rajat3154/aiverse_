"""Structured logging for the MCP Toolbox (AIVERSE logging standard).

Catalog discovery is domain TOOL; saved database connections are domain INTEGRATION. Only identifiers, counts and timings
are logged: never hosts, users, connection strings, passwords or keys.
"""
from aiverse_logging import get_logger, log_event

from configurations.messages import get_message

log = get_logger("aiverse.ai_server.database_toolbox")


def toolbox_log(level: str, outcome: str, action: str, key: str, *args, context: dict | None = None, exc_info: bool = False) -> None:
    log_event(log, level, get_message(key, *args), domain="TOOL", action=action, outcome=outcome, context=context, exc_info=exc_info)


def connection_log(level: str, outcome: str, action: str, key: str, *args, context: dict | None = None, exc_info: bool = False) -> None:
    log_event(log, level, get_message(key, *args), domain="INTEGRATION", action=action, outcome=outcome, context=context, exc_info=exc_info)
