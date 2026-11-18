import functools

from composio import exceptions as composio_exceptions
from composio_client import (
    APIConnectionError,
    APIStatusError,
    APITimeoutError,
    AuthenticationError,
    BadRequestError,
    NotFoundError,
    PermissionDeniedError,
    RateLimitError,
    UnprocessableEntityError,
)
from fastapi import HTTPException

from modules.integrations.logs import integration_log

# Upstream error text is never forwarded to clients: it can echo request payloads, identifiers or credentials.
GENERIC_NOT_FOUND = "Resource not found"
GENERIC_UPSTREAM = "Integration provider request failed"


def retry_after_seconds(exc: Exception) -> str | None:
    headers = getattr(getattr(exc, "response", None), "headers", None)
    if headers is None:
        return None
    return headers.get("retry-after") or headers.get("Retry-After")


def map_exception(exc: Exception) -> HTTPException:
    """Translate service and Composio failures into safe HTTP errors (and log provider failures)."""
    mapped = _map(exc)
    if mapped.status_code in (429, 502, 503, 504) or (mapped.status_code == 403 and not isinstance(exc, PermissionError)):
        integration_log("WARNING", "FAILURE", "UPSTREAM", "integration.upstream.failed", mapped.status_code, type(exc).__name__)
    return mapped


def _map(exc: Exception) -> HTTPException:
    if isinstance(exc, HTTPException):
        return exc
    if isinstance(exc, PermissionError):
        # Same answer for "missing" and "not yours" so ids cannot be probed.
        return HTTPException(status_code=404, detail=str(exc) or GENERIC_NOT_FOUND)
    if isinstance(exc, (KeyError, ValueError)):
        return HTTPException(status_code=400, detail=str(exc).strip("'\""))
    if isinstance(exc, RateLimitError):
        retry_after = retry_after_seconds(exc)
        return HTTPException(
            status_code=429,
            detail="Integration provider rate limit reached; retry later",
            headers={"Retry-After": str(retry_after)} if retry_after else None,
        )
    if isinstance(exc, (NotFoundError, composio_exceptions.NotFoundError)):
        return HTTPException(status_code=404, detail=GENERIC_NOT_FOUND)
    if isinstance(exc, PermissionDeniedError):
        return HTTPException(status_code=403, detail="The integration provider denied this request")
    if isinstance(exc, AuthenticationError):
        # AIverse's own provider key was rejected. 401 would make the client log the *user* out, so use 502.
        integration_log("ERROR", "FAILURE", "PROVIDER_AUTH", "integration.credentials.rejected")
        return HTTPException(status_code=502, detail="Integration provider authentication is not configured correctly")
    if isinstance(exc, (BadRequestError, UnprocessableEntityError)):
        return HTTPException(status_code=400, detail="Invalid request to integration provider")
    if isinstance(exc, APITimeoutError):
        return HTTPException(status_code=504, detail="Integration provider timed out")
    if isinstance(exc, APIConnectionError):
        return HTTPException(status_code=502, detail="Integration provider is unreachable")
    if isinstance(exc, (APIStatusError, composio_exceptions.ComposioError)):
        return HTTPException(status_code=502, detail=GENERIC_UPSTREAM)
    if isinstance(exc, RuntimeError):
        return HTTPException(status_code=503, detail=str(exc))
    integration_log("ERROR", "FAILURE", "UNHANDLED", "integration.unhandled", exc_info=True)
    return HTTPException(status_code=500, detail="Internal integration error")


def handle_integration_errors(func):
    """Route decorator that converts exceptions with map_exception()."""

    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except HTTPException:
            raise
        except Exception as exc:
            raise map_exception(exc) from exc

    return wrapper
