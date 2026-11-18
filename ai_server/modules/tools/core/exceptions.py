class ToolError(Exception):
    """Base exception for the tools module."""


class ToolProviderError(ToolError):
    """Provider initialization or operation failed."""


class ToolProviderNotFoundError(ToolProviderError):
    """Requested provider is not registered."""


class DuplicateToolProviderError(ToolProviderError):
    """A provider with the same key is already registered."""


class ToolNotFoundError(ToolError):
    """Requested tool does not exist."""


class ToolDiscoveryError(ToolProviderError):
    """Provider catalog discovery failed."""


class ToolExecutionError(ToolError):
    """Tool execution failed."""


class ToolValidationError(ToolError):
    """Tool definition or input validation failed."""


class ToolAccessDeniedError(ToolError):
    """The caller does not own the requested resource (reported as "not found" to avoid probing)."""


class ToolConnectionRequiredError(ToolError):
    """The tool needs a connected account and the user has none for its toolkit."""


class AmbiguousConnectionError(ToolError):
    """The user has several matching connected accounts and must choose one."""

    def __init__(self, message: str, candidates: list[dict] | None = None):
        super().__init__(message)
        self.candidates = candidates or []


class ConnectionInactiveError(ToolError):
    """The chosen connected account exists but is not ACTIVE."""

    def __init__(self, message: str, status: str | None = None):
        super().__init__(message)
        self.status = status


class ConnectionMismatchError(ToolValidationError):
    """The chosen connected account belongs to a different toolkit than the tool."""


class ToolRateLimitError(ToolProviderError):
    """The provider rate-limited the request."""

    def __init__(self, message: str = "Provider rate limit reached", retry_after: int | None = None):
        super().__init__(message)
        self.retry_after = retry_after


class ToolProviderUnavailableError(ToolProviderError):
    """The provider could not be reached or timed out."""


class ToolProviderAuthenticationError(ToolProviderError):
    """The provider rejected AIverse's own credentials (a server configuration problem, not the user's)."""


class ToolUpstreamNotFoundError(ToolNotFoundError):
    """The provider reported that the tool or account does not exist."""



class ToolProviderTimeoutError(ToolProviderUnavailableError):
    """The provider did not answer in time."""


class ToolProviderPermissionError(ToolProviderError):
    """The provider refused the request for this account or tool."""


class ToolkitNotFoundError(ToolNotFoundError):
    """The provider has no toolkit with this key."""
