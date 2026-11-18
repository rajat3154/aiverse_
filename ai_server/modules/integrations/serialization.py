"""Allow-list projections for provider objects returned to API clients.

Composio connected accounts carry OAuth tokens in ``state``/``data``/``params`` and auth configs carry
``credentials``. Responses copy only known-safe fields, so new upstream fields are never exposed by default.
"""
from typing import Any


def dump(value: Any) -> dict[str, Any]:
    if value is None:
        return {}
    if isinstance(value, dict):
        return value
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if hasattr(value, "__dict__"):
        return {k: v for k, v in vars(value).items() if not k.startswith("_")}
    return {}


def _pick(data: dict[str, Any], keys: tuple[str, ...]) -> dict[str, Any]:
    return {key: data[key] for key in keys if key in data}


def connection_view(connection: Any) -> dict[str, Any]:
    data = dump(connection)
    toolkit = dump(data.get("toolkit"))
    auth_config = dump(data.get("auth_config"))
    view = _pick(data, ("id", "status", "status_reason", "alias", "is_disabled", "created_at", "updated_at"))
    view["toolkit"] = _pick(toolkit, ("slug", "name", "logo"))
    view["auth_config_id"] = auth_config.get("id")
    view["auth_scheme"] = auth_config.get("auth_scheme")
    return view


def _page(response: Any, view) -> dict[str, Any]:
    if isinstance(response, list):
        return {"items": [view(item) for item in response]}
    data = dump(response)
    extra = _pick(data, ("next_cursor", "total_items", "total_pages", "current_page"))
    return {"items": [view(item) for item in data.get("items") or []], **extra}


def connection_list_view(response: Any) -> dict[str, Any]:
    return _page(response, connection_view)


def connection_request_view(request: Any) -> dict[str, Any]:
    """Result of starting an OAuth/API-key link: where to send the user."""
    return _pick(dump(request), ("id", "status", "redirect_url"))


def auth_config_view(auth_config: Any) -> dict[str, Any]:
    data = dump(auth_config)
    view = _pick(
        data,
        (
            "id", "name", "status", "auth_scheme", "is_composio_managed", "is_enabled_for_tool_router",
            "no_of_connections", "created_at", "last_updated_at",
        ),
    )
    toolkit = dump(data.get("toolkit"))
    if toolkit:
        view["toolkit"] = _pick(toolkit, ("slug", "name", "logo"))
    return view


def auth_config_list_view(response: Any) -> dict[str, Any]:
    return _page(response, auth_config_view)
