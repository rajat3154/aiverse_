
from contextlib import contextmanager
from contextvars import ContextVar, Token
from typing import Any, Iterator
from uuid import uuid4

_log_context: ContextVar[dict[str, Any] | None] = ContextVar("aiverse_log_context",
default=None)

def set_context(**values: Any) -> Token:
    current = _log_context.get() or {}
    return _log_context.set({**current, **values})

def get_context() -> dict[str, Any]:
    return (_log_context.get() or {}).copy()

def clear_context() -> Token:
    return _log_context.set({})

def reset_context(token: Token) -> None:
    _log_context.reset(token)

def generate_request_id() -> str:
    return str(uuid4())

@contextmanager
def log_context(**values: Any) -> Iterator[None]:
    token = set_context(**values)
    try:
        yield
    finally:
        reset_context(token)
