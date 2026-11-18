
import json
import time
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Sequence

from sqlalchemy import (
    ARRAY,
    String,
    any_,
    bindparam,
    func,
    not_,
    select,
    update,
)
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from modules.tools.catalog.hashing import calculate_hash, tool_definition_hash
from modules.tools.core.contracts import (
    BaseToolProvider,
    ToolDefinition,
    ToolDiscoveryResult,
)
from modules.tools.core.exceptions import ToolDiscoveryError, ToolValidationError
from modules.tools.logs import tool_log
from modules.tools.models import ToolCatalog, ToolProvider, ToolSyncHistory


@dataclass(slots=True)
class ToolSynchronizationResult:
    provider_key: str
    discovered: int
    inserted: int
    updated: int
    unchanged: int
    deactivated: int
    status: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "provider_key": self.provider_key,
            "discovered": self.discovered,
            "inserted": self.inserted,
            "updated": self.updated,
            "unchanged": self.unchanged,
            "deactivated": self.deactivated,
            "status": self.status,
        }


@dataclass(slots=True)
class ToolkitSynchronizationResult:
    provider_key: str
    toolkit_key: str
    discovered: int
    inserted: int
    updated: int
    unchanged: int
    deactivated: int
    status: str
    synced_at: datetime

    def counts(self) -> dict[str, int]:
        return {
            "discovered": self.discovered, "inserted": self.inserted, "updated": self.updated,
            "unchanged": self.unchanged, "deactivated": self.deactivated,
        }


class ToolCatalogSynchronizer:
    def __init__(self, batch_size: int = 500):
        if batch_size < 1 or batch_size > 5000:
            raise ValueError("batch_size must be between 1 and 5000")
        self.batch_size = batch_size

    @staticmethod
    def _prepare_provider(provider: BaseToolProvider) -> dict[str, Any]:
        manifest = provider.manifest
        data = manifest["provider"]
        return {
            "provider_key": provider.provider_key,
            "slug": data["slug"],
            "name": data["name"],
            "description": data.get("description"),
            "provider_type": data["type"],
            "status": data["status"],
            "manifest_version": data["version"],
            "manifest_hash": calculate_hash(manifest),
            "manifest": manifest,
            "capabilities": manifest.get("capabilities", {}),
            "sync_interval_minutes": max(
                0, int((manifest.get("configuration") or {}).get("sync_interval_minutes", 360) or 0)
            ),
            "enabled": data["status"] in ("active", "beta"),
        }

    @staticmethod
    def _prepare_tool(
        definition: ToolDefinition,
        provider_id,
        now: datetime,
        definition_hash: str | None = None,
    ) -> dict[str, Any]:
        return {
            "provider_id": provider_id,
            "external_tool_id": definition.external_tool_id,
            "slug": definition.slug,
            "name": definition.name,
            "description": definition.description,
            "category": definition.category,
            "toolkit_key": definition.toolkit_key,
            "connector_key": definition.connector_key,
            "execution_type": definition.execution_type,
            "input_schema": definition.input_schema,
            "output_schema": definition.output_schema,
            "auth_requirements": definition.auth_requirements,
            "tool_metadata": definition.metadata,
            "definition_hash": definition_hash or tool_definition_hash(definition),
            "version": definition.version,
            "status": definition.status,
            "enabled": definition.enabled and definition.status == "active",
            "first_seen_at": now,
            "last_seen_at": now,
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def _validate_discovery(definitions: Sequence[ToolDefinition]) -> None:
        external_ids: set[str] = set()
        slugs: set[str] = set()

        for definition in definitions:
            if not isinstance(definition, ToolDefinition):
                raise ToolValidationError(
                    "Provider discovery must return ToolDefinition instances"
                )
            if definition.external_tool_id in external_ids:
                raise ToolValidationError(
                    f"Duplicate external tool ID: {definition.external_tool_id}"
                )
            if definition.slug in slugs:
                raise ToolValidationError(
                    f"Duplicate tool slug: {definition.slug}"
                )
            if len(definition.external_tool_id) > 255:
                raise ToolValidationError("External tool ID exceeds 255 characters")
            if len(definition.slug) > 255:
                raise ToolValidationError("Tool slug exceeds 255 characters")
            external_ids.add(definition.external_tool_id)
            slugs.add(definition.slug)

    @staticmethod
    def _chunks(items: Sequence[Any], size: int):
        for start in range(0, len(items), size):
            yield items[start:start + size]

    async def _record_failure(
        self,
        session: AsyncSession,
        provider_key: str,
        trigger_type: str,
        started_at: datetime,
        error: Exception,
    ) -> None:
        async with session.begin():
            provider_result = await session.scalars(
                select(ToolProvider).where(
                    ToolProvider.provider_key == provider_key
                )
            )
            provider = provider_result.one_or_none()
            session.add(
                ToolSyncHistory(
                    provider_id=provider.id if provider else None,
                    trigger_type=trigger_type,
                    status="failed",
                    started_at=started_at,
                    completed_at=datetime.now(UTC),
                    error_details={
                        "error_type": type(error).__name__,
                        "message": str(error)[:2000],
                    },
                )
            )

    @staticmethod
    async def _load_existing(
        session: AsyncSession, provider_id, toolkit_key: str | None = None
    ) -> dict[str, tuple[str, bool, str]]:
        """What the database already holds for this provider (optionally one toolkit): id -> (hash, enabled, status)."""
        query = select(
            ToolCatalog.external_tool_id,
            ToolCatalog.definition_hash,
            ToolCatalog.enabled,
            ToolCatalog.status,
        ).where(ToolCatalog.provider_id == provider_id)
        if toolkit_key is not None:
            query = query.where(ToolCatalog.toolkit_key == toolkit_key)
        result = await session.execute(query)
        return {row.external_tool_id: (row.definition_hash, row.enabled, row.status) for row in result}

    @staticmethod
    async def _write_rows(session: AsyncSession, rows: list[dict[str, Any]], now: datetime) -> None:
        """Upsert rows that are new or changed. Unchanged rows are never sent."""
        statement = pg_insert(ToolCatalog).values(rows)
        excluded = statement.excluded
        statement = statement.on_conflict_do_update(
            index_elements=[ToolCatalog.provider_id, ToolCatalog.external_tool_id],
            set_={
                "slug": excluded.slug,
                "name": excluded.name,
                "description": excluded.description,
                "category": excluded.category,
                "toolkit_key": excluded.toolkit_key,
                "connector_key": excluded.connector_key,
                "execution_type": excluded.execution_type,
                "input_schema": excluded.input_schema,
                "output_schema": excluded.output_schema,
                "auth_requirements": excluded.auth_requirements,
                "metadata": excluded["metadata"],
                "definition_hash": excluded.definition_hash,
                "version": excluded.version,
                "status": excluded.status,
                "enabled": excluded.enabled,
                "last_seen_at": now,
                "updated_at": now,
            },
        )
        await session.execute(statement)

    async def _touch_seen(self, session: AsyncSession, provider_id, external_ids: list[str], now: datetime) -> None:
        """Unchanged tools only get their "last seen" time refreshed; the ids are all that travels."""
        seen_parameter = bindparam("seen_ids", type_=ARRAY(String(255)))
        for chunk in self._chunks(external_ids, 10000):
            await session.execute(
                update(ToolCatalog)
                .where(
                    ToolCatalog.provider_id == provider_id,
                    ToolCatalog.external_tool_id == any_(seen_parameter),
                )
                .values(last_seen_at=now)
                .execution_options(synchronize_session=False),
                {"seen_ids": list(chunk)},
            )

    async def toolkit_freshness(self, session: AsyncSession, provider_key: str, toolkit_key: str) -> datetime | None:
        """When this toolkit's tools were last confirmed by the provider (None if never loaded)."""
        result = await session.execute(
            select(func.max(ToolCatalog.last_seen_at))
            .join(ToolProvider, ToolCatalog.provider_id == ToolProvider.id)
            .where(
                ToolProvider.provider_key == provider_key,
                ToolCatalog.toolkit_key == toolkit_key,
                ToolCatalog.enabled.is_(True),
            )
        )
        return result.scalar_one_or_none()

    async def synchronize_toolkit(
        self,
        session: AsyncSession,
        provider: BaseToolProvider,
        toolkit_key: str,
        allow_empty: bool = False,
    ) -> ToolkitSynchronizationResult:
        """Load ONE toolkit's tools: a single provider fetch, one small transaction, nothing else is touched.

        Only that toolkit's tools can be added, changed or deactivated, and only when the fetch was complete.
        """
        provider_key = provider.provider_key
        toolkit_key = toolkit_key.strip().lower()
        discovery = await provider.discover_toolkit(toolkit_key)
        if not isinstance(discovery, ToolDiscoveryResult) or not isinstance(discovery.complete, bool):
            raise ToolValidationError("discover_toolkit() must return a ToolDiscoveryResult")
        definitions = list(discovery.tools)
        self._validate_discovery(definitions)
        if any((definition.toolkit_key or "").lower() != toolkit_key for definition in definitions):
            raise ToolValidationError(f"Provider returned tools outside toolkit '{toolkit_key}'")

        async with session.begin():
            await session.execute(
                select(func.pg_advisory_xact_lock(func.hashtextextended(f"{provider_key}:{toolkit_key}", 0)))
            )
            provider_row = (
                await session.scalars(select(ToolProvider).where(ToolProvider.provider_key == provider_key))
            ).one_or_none()
            if provider_row is None:
                # First contact: make the provider row so tools have a parent. last_synced_at stays empty because
                # only a full catalog sync may claim that the whole catalog is current.
                provider_row = ToolProvider(**self._prepare_provider(provider))
                session.add(provider_row)
                await session.flush()
            provider_id = provider_row.id
            now = datetime.now(UTC)
            existing = await self._load_existing(session, provider_id, toolkit_key)

            if discovery.complete and not definitions and existing and not allow_empty:
                raise ToolDiscoveryError(
                    f"Provider returned no tools for '{toolkit_key}', which already has {len(existing)}. "
                    "Refusing to deactivate them."
                )

            inserted = updated = unchanged = 0
            to_write: list[tuple[ToolDefinition, str]] = []
            unchanged_ids: list[str] = []
            for definition in definitions:
                definition_hash = tool_definition_hash(definition)
                enabled = definition.enabled and definition.status == "active"
                previous = existing.get(definition.external_tool_id)
                if previous is None:
                    inserted += 1
                    to_write.append((definition, definition_hash))
                elif previous != (definition_hash, enabled, definition.status):
                    updated += 1
                    to_write.append((definition, definition_hash))
                else:
                    unchanged += 1
                    unchanged_ids.append(definition.external_tool_id)
            for batch in self._chunks(to_write, self.batch_size):
                await self._write_rows(
                    session,
                    [self._prepare_tool(definition, provider_id, now, definition_hash) for definition, definition_hash in batch],
                    now,
                )
            await self._touch_seen(session, provider_id, unchanged_ids, now)

            deactivated = 0
            if discovery.complete:
                seen_parameter = bindparam("seen_ids", type_=ARRAY(String(255)))
                outcome = await session.execute(
                    update(ToolCatalog)
                    .where(
                        ToolCatalog.provider_id == provider_id,
                        ToolCatalog.toolkit_key == toolkit_key,
                        ToolCatalog.enabled.is_(True),
                        not_(ToolCatalog.external_tool_id == any_(seen_parameter)),
                    )
                    .values(enabled=False, status="inactive", updated_at=now)
                    .execution_options(synchronize_session=False),
                    {"seen_ids": [definition.external_tool_id for definition in definitions]},
                )
                deactivated = outcome.rowcount or 0

        return ToolkitSynchronizationResult(
            provider_key=provider_key,
            toolkit_key=toolkit_key,
            discovered=len(definitions),
            inserted=inserted,
            updated=updated,
            unchanged=unchanged,
            deactivated=deactivated,
            status="success" if discovery.complete else "partial",
            synced_at=now,
        )

    async def synchronize(self,session: AsyncSession,provider: BaseToolProvider,trigger_type: str = "manual",allow_empty_catalog: bool = False) -> ToolSynchronizationResult:
        started_at = datetime.now(UTC)
        provider_key = provider.provider_key
        try:
            tool_log("INFO", "STARTED", "SYNC", "tool.sync.started", provider_key, trigger_type)
            run_started = time.perf_counter()
            discovery = await provider.discover_tools()
            if not isinstance(discovery, ToolDiscoveryResult):
                raise ToolValidationError("discover_tools() must return ToolDiscoveryResult")
            if not isinstance(discovery.complete, bool):
                raise ToolValidationError("Discovery result 'complete' must be a boolean")

            definitions = list(discovery.tools)
            self._validate_discovery(definitions)

            if discovery.complete and not definitions and not allow_empty_catalog:
                raise ToolDiscoveryError("Provider returned an empty complete catalog. "
                    "Set allow_empty_catalog=True only when intentional.")

            fetch_seconds = round(time.perf_counter() - run_started, 1)
            prepared_provider = self._prepare_provider(provider)
            inserted = 0
            updated = 0
            unchanged = 0
            deactivated = 0
            async with session.begin():
                await session.execute(
                    select(func.pg_advisory_xact_lock(func.hashtextextended(provider_key, 0))))

                provider_result = await session.scalars(select(ToolProvider).where(ToolProvider.provider_key == provider_key).with_for_update())
                existing_provider = provider_result.one_or_none()
                if existing_provider is None:
                    existing_provider = ToolProvider(**prepared_provider)
                    session.add(existing_provider)
                    await session.flush()
                else:
                    for key, value in prepared_provider.items():
                        if key != "provider_key":
                            setattr(existing_provider, key, value)
                    existing_provider.updated_at = func.now()
                provider_id = existing_provider.id
                now = datetime.now(UTC)
                total = len(definitions)
                write_started = time.perf_counter()
                existing = await self._load_existing(session, provider_id)
                to_write: list[tuple[ToolDefinition, str]] = []
                unchanged_ids: list[str] = []
                for definition in definitions:
                    definition_hash = tool_definition_hash(definition)
                    enabled = definition.enabled and definition.status == "active"
                    previous = existing.get(definition.external_tool_id)
                    if previous is None:
                        inserted += 1
                        to_write.append((definition, definition_hash))
                    elif previous != (definition_hash, enabled, definition.status):
                        updated += 1
                        to_write.append((definition, definition_hash))
                    else:
                        unchanged += 1
                        unchanged_ids.append(definition.external_tool_id)
                tool_log("INFO", "COMPLETED", "SYNC_COMPARE", "tool.sync.compared", provider_key, inserted, updated, unchanged)

                for batch_number, batch in enumerate(self._chunks(to_write, self.batch_size),start=1):
                    batch_started = time.perf_counter()
                    await self._write_rows(session,[self._prepare_tool(definition, provider_id, now, definition_hash) for definition, definition_hash in batch],now)
                    processed = min(batch_number * self.batch_size, len(to_write))
                    tool_log("INFO", "COMPLETED", "SYNC_BATCH", "tool.sync.batch",provider_key, batch_number, processed, len(to_write),round(time.perf_counter() - batch_started, 1))

                await self._touch_seen(session, provider_id, unchanged_ids, now)
                write_seconds = round(time.perf_counter() - write_started, 1)

                if discovery.complete:
                    seen_parameter = bindparam("seen_ids",type_=ARRAY(String(255)))
                    deactivation = await session.execute(
                        update(ToolCatalog)
                        .where(
                            ToolCatalog.provider_id == provider_id,
                            ToolCatalog.enabled.is_(True),
                            not_(
                                ToolCatalog.external_tool_id == any_(
                                    seen_parameter
                                )
                            ),
                        )
                        .values(
                            enabled=False,
                            status="inactive",
                            updated_at=now,
                        )
                        .execution_options(synchronize_session=False),
                        {
                            "seen_ids": [
                                definition.external_tool_id
                                for definition in definitions
                            ]
                        },
                    )
                    deactivated = deactivation.rowcount or 0
                    existing_provider.last_synced_at = now

                existing_provider.updated_at = now
                safe_metadata = json.loads(json.dumps(discovery.metadata, default=str))
                session.add(ToolSyncHistory(
                        provider_id=provider_id,
                        trigger_type=trigger_type,
                        status="success" if discovery.complete else "partial",
                        started_at=started_at,
                        completed_at=now,
                        discovered_count=total,
                        inserted_count=inserted,
                        updated_count=updated,
                        unchanged_count=unchanged,
                        deactivated_count=deactivated,
                        error_details=None if discovery.complete else {
                            "reason": "Incomplete catalog discovery",
                            "metadata": safe_metadata,
                        }))

            result = ToolSynchronizationResult(provider_key=provider_key,discovered=len(definitions),inserted=inserted,updated=updated,unchanged=unchanged,deactivated=deactivated,status="success" if discovery.complete else "partial")
            tool_log("INFO", "COMPLETED", "SYNC", "tool.sync.completed",provider_key, result.status, result.discovered, result.inserted, result.updated,result.unchanged, result.deactivated, round(time.perf_counter() - run_started, 1),context={"fetch_s": fetch_seconds, "write_s": write_seconds})
            return result

        except Exception as exc:
            tool_log("ERROR", "FAILURE", "SYNC", "tool.sync.failed",provider_key, trigger_type, f"{type(exc).__name__}: {str(exc)[:300]}")
            try:
                await session.rollback()
                await self._record_failure(session=session,provider_key=provider_key,trigger_type=trigger_type,started_at=started_at,error=exc)
            except Exception as history_error:
                await session.rollback()
                tool_log("ERROR", "FAILURE", "SYNC", "tool.sync.history.failed", provider_key, exc_info=True)

            if isinstance(exc, (ToolDiscoveryError, ToolValidationError)):
                raise

            raise ToolDiscoveryError(f"Catalog synchronization failed for '{provider_key}': {exc}") from exc
