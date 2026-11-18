"""Turn Composio SDK / HTTP failures into the Tools module's provider exceptions.

Infrastructure failures (rate limits, auth, outages, timeouts, not-found) become exceptions so the API can answer with
the right HTTP status. Everything else is a tool-level failure and stays a normal failed result.
"""
from composio import exceptions as composio_exceptions
from composio_client import APIConnectionError,APIStatusError,APITimeoutError,AuthenticationError,NotFoundError,PermissionDeniedError,RateLimitError
from modules.tools.core.exceptions import ToolError,ToolProviderAuthenticationError,ToolProviderPermissionError,ToolProviderTimeoutError,ToolProviderUnavailableError,ToolRateLimitError,ToolUpstreamNotFoundError
from modules.tools.providers.composio.client import ComposioClientError


def _retry_after(exc: Exception) -> int | None:
    headers = getattr(getattr(exc, "response", None), "headers", None)
    value = (headers or {}).get("retry-after") if headers is not None else None
    try:
        return int(float(value)) if value is not None else None
    except (TypeError, ValueError):
        return None


def classify(exc: Exception) -> ToolError | None:
    """The matching ToolError for an infrastructure failure, or None if this is a tool-level failure."""
    if isinstance(exc, ToolError):
        return exc
    if isinstance(exc, ComposioClientError):
        return ToolProviderUnavailableError("Provider is not configured")
    if isinstance(exc, RateLimitError):
        return ToolRateLimitError(retry_after=_retry_after(exc))
    if isinstance(exc, AuthenticationError):
        return ToolProviderAuthenticationError("Provider rejected the server credentials")
    if isinstance(exc, PermissionDeniedError):
        return ToolProviderPermissionError("Provider denied this request")
    if isinstance(exc, (NotFoundError, composio_exceptions.NotFoundError)):
        return ToolUpstreamNotFoundError("Provider could not find the tool or connected account")
    if isinstance(exc, (APITimeoutError, composio_exceptions.ComposioSDKTimeoutError, TimeoutError)):
        return ToolProviderTimeoutError("Provider did not respond in time")
    if isinstance(exc, APIConnectionError):
        return ToolProviderUnavailableError("Provider is unreachable")
    if isinstance(exc, APIStatusError) and getattr(exc, "status_code", 500) >= 500:
        return ToolProviderUnavailableError("Provider is temporarily unavailable")
    return None
