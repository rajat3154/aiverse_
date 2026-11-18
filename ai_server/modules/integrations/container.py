"""Process-wide service instances. Routes depend on the getters so tests can override them."""
from functools import lru_cache

from modules.integrations.client import ComposioConnectionsClient
from modules.integrations.services.auth import AuthService
from modules.integrations.services.connections import ConnectionService


@lru_cache(maxsize=1)
def get_composio_client() -> ComposioConnectionsClient:
    return ComposioConnectionsClient()


def get_connection_service() -> ConnectionService:
    return _connection_service()


def get_auth_service() -> AuthService:
    return _auth_service()


@lru_cache(maxsize=1)
def _connection_service() -> ConnectionService:
    return ConnectionService(get_composio_client())


@lru_cache(maxsize=1)
def _auth_service() -> AuthService:
    return AuthService(get_composio_client())


def close_composio_client() -> None:
    get_composio_client().close()
    get_composio_client.cache_clear()
    _connection_service.cache_clear()
    _auth_service.cache_clear()
