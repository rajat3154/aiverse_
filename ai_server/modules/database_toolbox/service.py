import asyncio
import re
from typing import Any
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from modules.database_toolbox.connection_tester import TestResult, test_connection
from modules.database_toolbox.crypto import EncryptionNotConfigured, decrypt_secrets, encrypt_secrets
from modules.database_toolbox.logs import connection_log
from modules.database_toolbox.models import DatabaseConnection
from modules.database_toolbox.sources import Source, get_source


def _error(status: int, code: str, message: str, source: str = "-") -> HTTPException:
    if code == "encryption_not_configured":
        connection_log("ERROR", "FAILURE", "ENCRYPTION", "integration.dbconn.encryption.missing")
    else:
        connection_log("WARNING", "REJECTED", "CONNECTION_REQUEST", "integration.dbconn.rejected", source, code)
    return HTTPException(status_code=status, detail={"code": code, "message": message})


def _source_or_404(slug: str) -> Source:
    source = get_source(slug)
    if source is None:
        raise _error(404, "source_not_found", "Unknown database source")
    return source


def _coerce(source: Source, configuration: dict[str, Any]) -> dict[str, Any]:
    """Keep only the source's own fields, with integers as integers; blank values are dropped."""
    fields = {f.name: f for f in source.fields}
    unknown = sorted(set(configuration) - set(fields))
    if unknown:
        raise _error(400, "invalid_configuration", "Unknown field(s): " + ", ".join(unknown))
    cleaned: dict[str, Any] = {}
    for name, value in configuration.items():
        if value is None or (isinstance(value, str) and value.strip() == ""):
            continue
        if fields[name].type == "integer":
            try:
                value = int(value)
            except (TypeError, ValueError):
                raise _error(400, "invalid_configuration", f"{name} must be a number") from None
        elif not isinstance(value, str):
            raise _error(400, "invalid_configuration", f"{name} must be text")
        cleaned[name] = value
    return cleaned


_EMBEDDED_CREDENTIALS = re.compile(r"://[^/\s:@]*:[^@\s]+@")


def _split(source: Source, configuration: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    """Secret fields, and any other value that has a password inside it, are stored encrypted, never as plain settings."""
    secret_names = source.secret_fields

    def is_secret(name: str, value: Any) -> bool:
        return name in secret_names or (isinstance(value, str) and bool(_EMBEDDED_CREDENTIALS.search(value)))

    plain = {k: v for k, v in configuration.items() if not is_secret(k, v)}
    secrets = {k: v for k, v in configuration.items() if is_secret(k, v)}
    return plain, secrets


def _require_complete(source: Source, configuration: dict[str, Any]) -> None:
    missing = [f.name for f in source.fields if f.required and f.name not in configuration]
    if missing:
        raise _error(400, "invalid_configuration", "Missing required field(s): " + ", ".join(missing))


def to_response(connection: DatabaseConnection) -> dict[str, Any]:
    return {
        "id": connection.id,
        "name": connection.name,
        "slug": connection.source_slug,
        "configuration": connection.configuration or {},
        "saved_secret_fields": sorted(_saved_secret_names(connection)),
        "created_at": connection.created_at,
        "updated_at": connection.updated_at,
    }


def _saved_secret_names(connection: DatabaseConnection) -> set[str]:
    return set(_secrets_of(connection))


def _secrets_of(connection: DatabaseConnection) -> dict[str, Any]:
    try:
        return decrypt_secrets(connection.secret_configuration)
    except EncryptionNotConfigured as exc:
        raise _error(503, "encryption_not_configured", "Saved connections cannot be read until the encryption key is configured") from exc


class DatabaseConnectionService:
    async def list(self, db: AsyncSession, user_id: str) -> list[DatabaseConnection]:
        result = await db.execute(select(DatabaseConnection).where(DatabaseConnection.user_id == UUID(user_id)).order_by(DatabaseConnection.created_at.desc()))
        return list(result.scalars().all())

    async def _owned(self, db: AsyncSession, user_id: str, connection_id: UUID) -> DatabaseConnection:
        result = await db.execute(select(DatabaseConnection).where(DatabaseConnection.id == connection_id, DatabaseConnection.user_id == UUID(user_id)))
        connection = result.scalar_one_or_none()
        if connection is None:
            raise _error(404, "connection_not_found", "Connection not found")
        return connection

    async def create(self, db: AsyncSession, user_id: str, name: str, slug: str, configuration: dict[str, Any]) -> DatabaseConnection:
        source = _source_or_404(slug)
        cleaned = _coerce(source, configuration)
        _require_complete(source, cleaned)
        plain, secrets = _split(source, cleaned)
        try:
            token = encrypt_secrets(secrets)
        except EncryptionNotConfigured as exc:
            raise _error(503, "encryption_not_configured", "Saving connections is not configured on the server") from exc
        connection = DatabaseConnection(user_id=UUID(user_id), name=name.strip(), source_slug=source.slug, configuration=plain, secret_configuration=token)
        db.add(connection)
        await self._commit(db)
        await db.refresh(connection)
        connection_log("INFO", "COMPLETED", "CONNECTION_CREATE", "integration.dbconn.created", source.slug)
        return connection

    async def update(self, db: AsyncSession, user_id: str, connection_id: UUID, name: str, slug: str, configuration: dict[str, Any]) -> DatabaseConnection:
        connection = await self._owned(db, user_id, connection_id)
        source = _source_or_404(slug)
        if source.slug != connection.source_slug:
            raise _error(400, "invalid_configuration", "The source of a connection cannot be changed")
        cleaned = _coerce(source, configuration)
        plain, new_secrets = _split(source, cleaned)
        # A blank secret means "keep the saved one".
        secrets = {**_secrets_of(connection), **new_secrets}
        _require_complete(source, {**plain, **secrets})
        try:
            token = encrypt_secrets(secrets)
        except EncryptionNotConfigured as exc:
            raise _error(503, "encryption_not_configured", "Saving connections is not configured on the server") from exc
        connection.name = name.strip()
        connection.configuration = plain
        connection.secret_configuration = token
        connection.updated_at = func.now()
        await self._commit(db)
        await db.refresh(connection)
        connection_log("INFO", "COMPLETED", "CONNECTION_UPDATE", "integration.dbconn.updated", source.slug)
        return connection

    async def delete(self, db: AsyncSession, user_id: str, connection_id: UUID) -> None:
        connection = await self._owned(db, user_id, connection_id)
        await db.execute(delete(DatabaseConnection).where(DatabaseConnection.id == connection.id))
        await db.commit()
        connection_log("INFO", "COMPLETED", "CONNECTION_DELETE", "integration.dbconn.deleted", connection.source_slug)

    async def test(self, db: AsyncSession, user_id: str, slug: str, configuration: dict[str, Any], connection_id: UUID | None) -> TestResult:
        source = _source_or_404(slug)
        cleaned = _coerce(source, configuration)
        if connection_id is not None:
            saved = await self._owned(db, user_id, connection_id)
            if saved.source_slug != source.slug:
                raise _error(400, "invalid_configuration", "The source of a connection cannot be changed")
            cleaned = {**_secrets_of(saved), **cleaned}
        # Drivers are blocking (and some start their own event loop), so run them off the request loop.
        result = await asyncio.to_thread(test_connection, source.slug, cleaned)
        connection_log("INFO", "COMPLETED" if result.success else "FAILURE", "CONNECTION_TEST", "integration.dbconn.tested",
                       source.slug, result.success, result.error_code or "OK", result.latency_ms)
        return result

    @staticmethod
    async def _commit(db: AsyncSession) -> None:
        try:
            await db.commit()
        except IntegrityError as exc:
            await db.rollback()
            raise _error(409, "connection_name_taken", "You already have a connection with this name") from exc


database_connection_service = DatabaseConnectionService()
