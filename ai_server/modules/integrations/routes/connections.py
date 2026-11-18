import os
from urllib.parse import urlsplit

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict, Field, model_validator

from modules.authentication import get_current_user_id
from modules.integrations.container import get_auth_service, get_connection_service
from modules.integrations.errors import handle_integration_errors
from modules.integrations.logs import integration_log
from modules.integrations.serialization import (
    auth_config_list_view,
    auth_config_view,
    connection_list_view,
    connection_request_view,
    connection_view,
)
from modules.integrations.services.auth import AuthService
from modules.integrations.services.connections import ConnectionService

router = APIRouter(prefix="/api/integrations", tags=["Integration Connections"])


def _allowed_callback_origins() -> set[str]:
    raw = os.getenv("INTEGRATIONS_ALLOWED_CALLBACK_ORIGINS", "http://localhost:5173")
    return {origin.strip().rstrip("/") for origin in raw.split(",") if origin.strip()}


def _validate_callback_url(callback_url: str) -> str:
    parts = urlsplit(callback_url)
    origin = f"{parts.scheme}://{parts.netloc}"
    if parts.scheme not in ("http", "https") or origin not in _allowed_callback_origins():
        integration_log("WARNING", "REJECTED", "CONNECT", "integration.connection.rejected", "callback_origin_not_allowed")
        raise ValueError("callback_url origin is not allowed")
    return callback_url


class AuthConfigRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    toolkit: str
    options: dict = Field(default_factory=dict)


class AuthConfigUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    options: dict = Field(default_factory=dict)


class ConnectionRequest(BaseModel):
    """Start linking an account. Provide an auth config or just a toolkit."""

    model_config = ConfigDict(extra="forbid")
    auth_config_id: str | None = None
    toolkit: str | None = None
    callback_url: str | None = None
    alias: str | None = None
    allow_multiple: bool = False

    @model_validator(mode="after")
    def _exactly_one_target(self):
        if bool(self.auth_config_id) == bool(self.toolkit):
            raise ValueError("Provide exactly one of auth_config_id or toolkit")
        return self


# ---- Auth configs (administrative; the Gateway restricts these to MASTER) ----

@router.post("/auth-configs")
@handle_integration_errors
async def create_auth_config(
    request: AuthConfigRequest,
    user_id: str = Depends(get_current_user_id),
    auth: AuthService = Depends(get_auth_service),
):
    return auth_config_view(await auth.create_auth_config(request.toolkit, request.options))


@router.get("/auth-configs")
@handle_integration_errors
async def list_auth_configs(
    user_id: str = Depends(get_current_user_id),
    auth: AuthService = Depends(get_auth_service),
):
    return auth_config_list_view(await auth.list_auth_configs())


@router.get("/auth-configs/{auth_config_id}")
@handle_integration_errors
async def get_auth_config(
    auth_config_id: str,
    user_id: str = Depends(get_current_user_id),
    auth: AuthService = Depends(get_auth_service),
):
    return auth_config_view(await auth.get_auth_config(auth_config_id))


@router.patch("/auth-configs/{auth_config_id}")
@handle_integration_errors
async def update_auth_config(
    auth_config_id: str,
    request: AuthConfigUpdateRequest,
    user_id: str = Depends(get_current_user_id),
    auth: AuthService = Depends(get_auth_service),
):
    await auth.update_auth_config(auth_config_id, request.options)
    return auth_config_view(await auth.get_auth_config(auth_config_id))


@router.delete("/auth-configs/{auth_config_id}")
@handle_integration_errors
async def delete_auth_config(
    auth_config_id: str,
    user_id: str = Depends(get_current_user_id),
    auth: AuthService = Depends(get_auth_service),
):
    return {"success": bool(await auth.delete_auth_config(auth_config_id))}


# ---- Connected accounts (always scoped to the authenticated user) ----

@router.post("/connections")
@handle_integration_errors
async def initiate_connection(
    request: ConnectionRequest,
    user_id: str = Depends(get_current_user_id),
    auth: AuthService = Depends(get_auth_service),
):
    options = {}
    if request.callback_url:
        options["callback_url"] = _validate_callback_url(request.callback_url)
    if request.alias:
        options["alias"] = request.alias
    if request.allow_multiple:
        options["allow_multiple"] = True
    auth_config_id = request.auth_config_id or await auth.resolve_auth_config_id(request.toolkit)
    integration_log(
        "INFO", "STARTED", "CONNECT", "integration.connection.initiated",
        request.toolkit or "by_auth_config", "toolkit" if request.toolkit else "auth_config",
    )
    return connection_request_view(await auth.initiate_connection(user_id, auth_config_id, **options))


@router.get("/connections")
@handle_integration_errors
async def list_connections(
    toolkit: str | None = None,
    status: str | None = None,
    cursor: str | None = None,
    limit: int | None = Query(default=None, ge=1, le=100),
    user_id: str = Depends(get_current_user_id),
    connections: ConnectionService = Depends(get_connection_service),
):
    filters = {}
    if toolkit:
        filters["toolkit_slugs"] = [toolkit.strip().lower()]
    if status:
        filters["statuses"] = [status.strip().upper()]
    if cursor:
        filters["cursor"] = cursor
    if limit:
        filters["limit"] = limit
    return connection_list_view(await connections.list_connections(user_id, **filters))


@router.get("/connections/{connection_id}")
@handle_integration_errors
async def get_connection(
    connection_id: str,
    user_id: str = Depends(get_current_user_id),
    connections: ConnectionService = Depends(get_connection_service),
):
    """Connection status, used by the frontend to poll after OAuth returns."""
    return connection_view(await connections.get_user_connection(connection_id, user_id))


@router.delete("/connections/{connection_id}")
@handle_integration_errors
async def revoke_connection(
    connection_id: str,
    user_id: str = Depends(get_current_user_id),
    connections: ConnectionService = Depends(get_connection_service),
):
    revoked = bool(await connections.revoke_connection(connection_id, user_id))
    integration_log("INFO", "COMPLETED", "REVOKE", "integration.connection.revoked", connection_id)
    return {"success": revoked}
