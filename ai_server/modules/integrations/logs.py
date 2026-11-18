"""Structured logging for connected-account management (event domain INTEGRATION). Never logs tokens or credentials."""
from aiverse_logging import get_logger, log_event

from configurations.messages import get_message

log = get_logger("aiverse.ai_server.integrations")


def integration_log(level: str, outcome: str, action: str, key: str, *args, context: dict | None = None, exc_info: bool = False) -> None:
    log_event(log, level, get_message(key, *args), domain="INTEGRATION", action=action, outcome=outcome, context=context, exc_info=exc_info)
