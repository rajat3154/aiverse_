"""Security events for gateway authentication (event domain SECURITY). Header values are never logged."""
from aiverse_logging import get_logger, log_event

from configurations.messages import get_message

log = get_logger("aiverse.ai_server.security")


def security_log(level: str, outcome: str, action: str, key: str, *args, context: dict | None = None) -> None:
    log_event(log, level, get_message(key, *args), domain="SECURITY", action=action, outcome=outcome, context=context)
