from dataclasses import dataclass
from typing import Any

from modules.integrations.services.connections import ConnectionService
from modules.tools.core.exceptions import AmbiguousConnectionError,ConnectionInactiveError,ConnectionMismatchError,ToolAccessDeniedError,ToolConnectionRequiredError,ToolValidationError



def _field(item: Any, key: str) -> Any:
    return item.get(key) if isinstance(item, dict) else getattr(item, key, None)


def _toolkit_of(connection: Any) -> str | None:
    toolkit = _field(connection, "toolkit")
    slug = _field(toolkit, "slug") if toolkit is not None else None
    return slug.lower() if isinstance(slug, str) else None


@dataclass(slots=True)
class ResolvedAccount:
    id: str
    alias: str | None
    toolkit: str | None
    status: str
    source: str 


class ToolAccountResolver:
    """Decides which connected account a tool call uses, and proves it belongs to the caller.

    Rules: a named account must be the caller's, ACTIVE, and for the tool's toolkit. Otherwise the caller's single
    ACTIVE account for that toolkit is used; none -> ToolConnectionRequiredError (400), several ->
    AmbiguousConnectionError (409).
    """

    def __init__(self, connections: ConnectionService):
        self.connections = connections

    @staticmethod
    def requires_account(tool: Any) -> bool:
        return bool((getattr(tool, "auth_requirements", None) or {}).get("required", False))

    async def resolve(self, tool: Any, user_id: str, connected_account_id: str | None = None) -> ResolvedAccount | None:
        toolkit = (getattr(tool, "toolkit_key", None) or "").lower() or None
        if connected_account_id:
            try:
                connection = await self.connections.get_user_connection(connected_account_id, user_id)
            except PermissionError as exc:
                raise ToolAccessDeniedError("Connected account not found") from exc
            status = _field(connection, "status")
            if status != "ACTIVE":
                raise ConnectionInactiveError(f"Connected account is {str(status).lower() if status else 'not active'}; reconnect it first",status=status)
            connection_toolkit = _toolkit_of(connection)
            if toolkit and connection_toolkit and connection_toolkit != toolkit:
                raise ConnectionMismatchError(f"Connected account is for '{connection_toolkit}', but this tool belongs to '{toolkit}'")
            return ResolvedAccount(
                id=str(_field(connection, "id") or connected_account_id),
                alias=_field(connection, "alias"),
                toolkit=connection_toolkit,
                status=status,
                source="explicit",
            )

        if not self.requires_account(tool):
            return None
        if not toolkit:
            raise ToolValidationError("This tool does not declare a toolkit, so connected_account_id is required")

        active = await self.connections.list_active_for_toolkit(user_id, toolkit)
        if not active:
            raise ToolConnectionRequiredError(f"Connect a {toolkit} account before using this tool")
        if len(active) > 1:
            raise AmbiguousConnectionError(f"You have {len(active)} active {toolkit} accounts; choose one with connected_account_id",candidates=[{"id": str(_field(item, "id")), "alias": _field(item, "alias")} for item in active])
        only = active[0]
        return ResolvedAccount(
            id=str(_field(only, "id")),
            alias=_field(only, "alias"),
            toolkit=toolkit,
            status="ACTIVE",
            source="auto",
        )
