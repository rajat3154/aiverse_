from typing import Any

from modules.integrations.client import ComposioConnectionsClient
from modules.integrations.logs import integration_log


def _field(item: Any, key: str) -> Any:
    return item.get(key) if isinstance(item, dict) else getattr(item, key, None)


def _toolkit_slug(connection: Any) -> str | None:
    toolkit = _field(connection, "toolkit")
    slug = toolkit.get("slug") if isinstance(toolkit, dict) else getattr(toolkit, "slug", None)
    return slug.lower() if isinstance(slug, str) else None


class ConnectionService:
    """Connected accounts, always scoped to the authenticated user."""

    def __init__(self, client: ComposioConnectionsClient):
        self.client = client

    @property
    def _accounts(self):
        return self.client.sdk.connected_accounts

    async def get_connection(self, connection_id: str) -> Any:
        return await self.client.call(self._accounts.get, connection_id)

    async def get_user_connection(self, connection_id: str, user_id: str) -> Any:
        """Fetch one connection, refusing anything that does not belong to ``user_id``."""
        connection = await self.get_connection(connection_id)
        owner_id = _field(connection, "user_id")
        if owner_id is None or str(owner_id) != str(user_id):
            integration_log("WARNING", "REJECTED", "CONNECTION_ACCESS", "integration.connection.denied", connection_id)
            raise PermissionError("Connection not found or access denied")
        return connection

    async def list_connections(self, user_id: str, **filters: Any) -> Any:
        if "user_ids" in filters:
            raise ValueError("Connection user scope cannot be overridden")
        return await self.client.call(self._accounts.list, user_ids=[user_id], **filters)

    async def list_active_for_toolkit(self, user_id: str, toolkit_slug: str) -> list[Any]:
        """The user's ACTIVE accounts for one toolkit. Ownership, status and toolkit are re-checked on every row."""
        toolkit = toolkit_slug.strip().lower()
        response = await self.list_connections(
            user_id, toolkit_slugs=[toolkit], statuses=["ACTIVE"], limit=100
        )
        items = response if isinstance(response, list) else (_field(response, "items") or [])
        return [
            item
            for item in items
            if str(_field(item, "user_id")) == str(user_id)
            and _field(item, "status") == "ACTIVE"
            and _toolkit_slug(item) == toolkit
        ]

    async def revoke_connection(self, connection_id: str, user_id: str) -> Any:
        await self.get_user_connection(connection_id, user_id)
        return await self.client.call(self._accounts.revoke, connection_id)
