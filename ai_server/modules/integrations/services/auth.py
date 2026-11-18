from typing import Any

from modules.integrations.client import ComposioConnectionsClient


class AuthService:
    """Auth configs (administrative) and the OAuth link that starts a connection."""

    def __init__(self, client: ComposioConnectionsClient):
        self.client = client

    @property
    def _sdk(self):
        return self.client.sdk

    async def create_auth_config(self, toolkit: str, options: dict[str, Any]) -> Any:
        return await self.client.call(self._sdk.auth_configs.create, toolkit, options)

    async def list_auth_configs(self, **filters: Any) -> Any:
        return await self.client.call(self._sdk.auth_configs.list, **filters)

    async def get_auth_config(self, auth_config_id: str) -> Any:
        return await self.client.call(self._sdk.auth_configs.get, auth_config_id)

    async def update_auth_config(self, auth_config_id: str, options: dict[str, Any]) -> Any:
        return await self.client.call(self._sdk.auth_configs.update, auth_config_id, options=options)

    async def delete_auth_config(self, auth_config_id: str) -> Any:
        return await self.client.call(self._sdk.auth_configs.delete, auth_config_id)

    async def resolve_auth_config_id(self, toolkit: str) -> str:
        """The enabled auth config a regular user may connect through."""
        response = await self.list_auth_configs(toolkit_slug=toolkit.strip().lower())
        if isinstance(response, list):
            items = response
        elif isinstance(response, dict):
            items = response.get("items") or []
        else:
            items = getattr(response, "items", None) or []
        for item in items:
            get = item.get if isinstance(item, dict) else (lambda key, default=None, item=item: getattr(item, key, default))
            if get("status") in (None, "ENABLED") and not get("is_disabled", False):
                return get("id")
        raise KeyError(f"No auth config is available for toolkit '{toolkit}'")

    async def initiate_connection(self, user_id: str, auth_config_id: str, **options: Any) -> Any:
        return await self.client.call(self._sdk.connected_accounts.link, user_id, auth_config_id, **options)
