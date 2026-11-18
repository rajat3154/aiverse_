"""Structured logging for the Tools module (event domain TOOL), following the AIVERSE logging standard.

Only identifiers, counts and timings are logged. Arguments, tool output, tokens and secrets never appear here.
"""
from aiverse_logging import get_logger, log_event

from configurations.messages import get_message

log = get_logger("aiverse.ai_server.tools")


def tool_log(level: str, outcome: str, action: str, key: str, *args, context: dict | None = None, exc_info: bool = False) -> None:
    log_event(log, level, get_message(key, *args), domain="TOOL", action=action, outcome=outcome, context=context, exc_info=exc_info)
