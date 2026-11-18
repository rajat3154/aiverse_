"""Data-protection helpers: nothing sensitive or oversized is persisted in execution history."""
import json
import re
from typing import Any

_SENSITIVE_KEY = re.compile(r"(pass(word|wd)?|secret|token|api[-_]?key|authorization|credential|private[-_]?key|cookie|bearesession[-_]?id)",re.IGNORECASE)
REDACTED = "[REDACTED]"
MAX_SNAPSHOT_BYTES = 32 * 1024
MAX_MESSAGE_CHARS = 2000


def redact(value: Any, _depth: int = 0) -> Any:
    """Copy of ``value`` with the values of sensitive-looking keys replaced."""
    if _depth > 12:
        return REDACTED
    if isinstance(value, dict):
        return {
            key: REDACTED if isinstance(key, str) and _SENSITIVE_KEY.search(key) else redact(item, _depth + 1)
            for key, item in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [redact(item, _depth + 1) for item in value]
    return value


def snapshot(value: Any) -> Any:
    """Redacted, JSON-safe, size-capped copy suitable for a history row."""
    safe = json.loads(json.dumps(redact(value), default=str))
    size = len(json.dumps(safe, default=str).encode("utf-8"))
    if size > MAX_SNAPSHOT_BYTES:
        return {"truncated": True, "size_bytes": size}
    return safe


def short_message(message: Any) -> str:
    return str(message)[:MAX_MESSAGE_CHARS]
