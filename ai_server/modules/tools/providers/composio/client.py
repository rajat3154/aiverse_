import asyncio
import os
from typing import Any
from composio import Composio

REQUEST_TIMEOUT_SECONDS = 30

class ComposioClientError(Exception):
    pass

class ComposioSDKClient:
    """Lazy Composio SDK wrapper.

    The SDK is synchronous, so every network call runs in a worker thread to keep the FastAPI event loop free.
    """
    def __init__(self, api_key: str | None = None):
        self._api_key = api_key
        self._client: Composio | None = None

    def _get_client(self) -> Composio:
        if self._client is None:
            api_key = self._api_key or os.getenv("COMPOSIO_API_KEY")
            if not api_key:
                raise ComposioClientError("COMPOSIO_API_KEY is not configured")
            self._client = Composio(api_key=api_key, timeout=float(REQUEST_TIMEOUT_SECONDS))
        return self._client

    async def list_toolkits(self,cursor: str | None = None,limit: int = 100,include_deprecated: bool = True,toolkit_type: str = "all") -> Any:
        def request():
            return self._get_client()._client.toolkits.list(
                cursor=cursor,
                limit=limit,
                include_deprecated=include_deprecated,
                type=toolkit_type,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )

        return await asyncio.to_thread(request)

    async def list_tools(self,cursor: str | None = None,limit: int = 100,include_deprecated: bool = True,toolkit_slug: str | None = None) -> Any:
        def request():
            options: dict[str, Any] = {
                "cursor": cursor,
                "limit": limit,
                "include_deprecated": include_deprecated,
            }
            if toolkit_slug:
                options["toolkit_slug"] = toolkit_slug
            return self._get_client()._client.tools.list(timeout=REQUEST_TIMEOUT_SECONDS,**{key: value for key, value in options.items() if value is not None})
        return await asyncio.to_thread(request)

    async def close(self) -> None:
        sdk, self._client = self._client, None
        closer = getattr(getattr(sdk, "_client", None), "close", None)
        if callable(closer):
            await asyncio.to_thread(closer)

    async def execute_tool(self,slug: str,arguments: dict[str, Any],user_id: str,connected_account_id: str | None = None) -> Any:
        def request():
            options: dict[str, Any] = {"user_id": user_id}
            if connected_account_id:
                options["connected_account_id"] = connected_account_id
            return self._get_client().tools.execute(slug, arguments, **options)
        return await asyncio.to_thread(request)
