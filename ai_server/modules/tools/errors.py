import functools
from typing import Any

from fastapi import HTTPException

from modules.integrations.errors import map_exception as map_integration_exception
from modules.tools.logs import tool_log
from modules.tools.core.exceptions import (
    AmbiguousConnectionError,
    ConnectionInactiveError,
    ConnectionMismatchError,
    ToolAccessDeniedError,
    ToolConnectionRequiredError,
    ToolDiscoveryError,
    ToolExecutionError,
    ToolNotFoundError,
    ToolkitNotFoundError,
    ToolProviderAuthenticationError,
    ToolProviderNotFoundError,
    ToolProviderPermissionError,
    ToolProviderTimeoutError,
    ToolProviderUnavailableError,
    ToolRateLimitError,
    ToolUpstreamNotFoundError,
    ToolValidationError,
)

_CODES_BY_STATUS = {400: "bad_request", 401: "unauthorized", 403: "forbidden", 404: "not_found", 409: "conflict",
                    429: "rate_limited", 500: "internal_error", 502: "provider_error", 503: "provider_unavailable",
                    504: "provider_timeout"}


def _error(status: int, code: str, message: str, headers: dict[str, str] | None = None, **extra: Any) -> HTTPException:
    """Every Tools API error carries ``detail: {code, message, ...}`` so clients can branch on ``code``."""
    return HTTPException(status_code=status, detail={"code": code, "message": message, **extra}, headers=headers)


def tool_http_exception(exc: Exception) -> HTTPException:
    if isinstance(exc, HTTPException):
        return exc
    # Most specific first.
    if isinstance(exc, ToolUpstreamNotFoundError):
        return _error(404, "upstream_not_found", "The provider could not find this tool or connected account")
    if isinstance(exc, ToolkitNotFoundError):
        return _error(404, "toolkit_not_found", "Toolkit not found")
    if isinstance(exc, ToolNotFoundError):
        return _error(404, "tool_not_found", "Tool not found")
    if isinstance(exc, ToolProviderNotFoundError):
        return _error(404, "provider_not_found", "Tool provider not found")
    if isinstance(exc, ToolAccessDeniedError):
        return _error(404, "connection_not_found", "Connected account not found")
    if isinstance(exc, ConnectionMismatchError):
        return _error(400, "connection_toolkit_mismatch", str(exc))
    if isinstance(exc, ToolConnectionRequiredError):
        return _error(400, "connection_required", str(exc))
    if isinstance(exc, ToolValidationError):
        return _error(400, "validation_error", str(exc))
    if isinstance(exc, AmbiguousConnectionError):
        return _error(409, "ambiguous_connection", str(exc), candidates=exc.candidates)
    if isinstance(exc, ConnectionInactiveError):
        return _error(409, "connection_inactive", str(exc), connection_status=exc.status)
    if isinstance(exc, ToolRateLimitError):
        headers = {"Retry-After": str(exc.retry_after)} if exc.retry_after else None
        return _error(429, "rate_limited", "The provider rate limit was reached; retry later", headers,
                      retry_after=exc.retry_after)
    if isinstance(exc, ToolProviderPermissionError):
        return _error(403, "provider_forbidden", "The provider denied this request")
    if isinstance(exc, ToolProviderAuthenticationError):
        # AIverse's own provider key was rejected; 401 would wrongly log the user out.
        tool_log("ERROR", "FAILURE", "PROVIDER_AUTH", "tool.api.provider.credentials")
        return _error(502, "provider_authentication_failed", "Provider authentication is not configured correctly")
    if isinstance(exc, ToolProviderTimeoutError):
        return _error(504, "provider_timeout", "The provider did not respond in time")
    if isinstance(exc, ToolProviderUnavailableError):
        return _error(503, "provider_unavailable", "The provider is currently unavailable")
    if isinstance(exc, ToolDiscoveryError):
        return _error(502, "discovery_failed", "Catalog discovery failed at the provider")
    if isinstance(exc, ToolExecutionError):
        return _error(500, "execution_failed", "Tool execution could not be completed")

    # Composio SDK / transport errors raised by the connection layer.
    mapped = map_integration_exception(exc)
    if mapped.status_code == 500:
        tool_log("ERROR", "FAILURE", "UNHANDLED", "tool.api.unhandled", exc_info=True)
    detail = mapped.detail if isinstance(mapped.detail, str) else "Request failed"
    return _error(
        mapped.status_code,
        _CODES_BY_STATUS.get(mapped.status_code, "error"),
        detail,
        dict(mapped.headers) if mapped.headers else None,
    )


def handle_tool_errors(func):
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except HTTPException:
            raise
        except Exception as exc:
            mapped = tool_http_exception(exc)
            if mapped.status_code >= 500 or mapped.status_code == 429:
                # 4xx answers are the caller's doing and already appear in the request log; these are ours or the provider's
                detail = mapped.detail if isinstance(mapped.detail, dict) else {}
                tool_log(
                    "WARNING" if mapped.status_code < 500 else "ERROR", "FAILURE", "API", "tool.api.failed",
                    mapped.status_code, detail.get("code", "unknown"),
                    context={"error_type": type(exc).__name__},
                )
            raise mapped from exc

    return wrapper
