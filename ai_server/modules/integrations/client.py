import asyncio
import os
from typing import Any, Callable

from composio import Composio


class ComposioNotConfiguredError(RuntimeError):
    pass


class ComposioConnectionsClient:
    """Lazy Composio SDK holder. The SDK is synchronous, so calls run in worker threads off the event loop."""

    def __init__(self, api_key: str | None = None, timeout: float | None = None, max_retries: int | None = None):
        self._api_key = api_key
        self._timeout = timeout
        self._max_retries = max_retries
        self._sdk: Composio | None = None

    @property
    def configured(self) -> bool:
        return bool(self._api_key or os.getenv("COMPOSIO_API_KEY"))

    @property
    def sdk(self) -> Composio:
        if self._sdk is None:
            api_key = self._api_key or os.getenv("COMPOSIO_API_KEY")
            if not api_key:
                raise ComposioNotConfiguredError("COMPOSIO_API_KEY is not configured")
            self._sdk = Composio(
                api_key=api_key,
                timeout=self._timeout if self._timeout is not None else float(os.getenv("COMPOSIO_TIMEOUT", "30")),
                max_retries=self._max_retries if self._max_retries is not None else int(os.getenv("COMPOSIO_MAX_RETRIES", "2")),
            )
        return self._sdk

    async def call(self, method: Callable[..., Any], *args: Any, **kwargs: Any) -> Any:
        return await asyncio.to_thread(method, *args, **kwargs)

    def close(self) -> None:
        sdk, self._sdk = self._sdk, None
        closer = getattr(getattr(sdk, "_client", None), "close", None)
        if callable(closer):
            try:
                closer()
            except Exception:  # best effort during shutdown
                pass
