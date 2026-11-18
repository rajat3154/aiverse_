import asyncio
import time
from datetime import UTC, datetime, timedelta
from typing import Any

from modules.tools.catalog.synchronizer import ToolCatalogSynchronizer
from modules.tools.core.exceptions import ToolValidationError
from modules.tools.core.registry import ToolProviderRegistry
from modules.tools.logs import tool_log
from modules.tools.services.catalog import ToolCatalogService

DEFAULT_REFRESH_HOURS = 24
FORCE_MIN_AGE = timedelta(minutes=15)


def _session_factory():
    from configurations.databases.database import AsyncSessionLocal
    return AsyncSessionLocal


class ToolkitRefreshService:
    """Keeps ONE toolkit's tools current, on demand.

    Nothing is fetched up front. The first time anyone opens an app its tools are loaded from the provider; after that
    they are reused until they are a day old (``configuration.toolkit_refresh_hours`` in the manifest). Because every
    caller goes through the same freshness check, the provider is contacted at most once per toolkit per day however
    many users open it, and an explicit refresh is throttled to once per 15 minutes.
    """

    def __init__(self,registry: ToolProviderRegistry,synchronizer: ToolCatalogSynchronizer | None = None,session_factory=None):
        self.registry = registry
        self.synchronizer = synchronizer or ToolCatalogSynchronizer()
        self._session_factory = session_factory or _session_factory
        self._locks: dict[tuple[str, str], asyncio.Lock] = {}

    def _resolve_provider(self, provider_key: str | None):
        keys = self.registry.keys()
        key = provider_key or (keys[0] if len(keys) == 1 else None)
        if key is None:
            raise ToolValidationError("provider_key is required when several tool providers are loaded")
        provider = self.registry.get(key)
        if not provider.supports_toolkit_discovery:
            raise ToolValidationError(f"Provider '{provider.provider_key}' cannot load one toolkit at a time")
        return provider

    @staticmethod
    def max_age(provider) -> timedelta:
        hours = (provider.manifest.get("configuration") or {}).get("toolkit_refresh_hours", DEFAULT_REFRESH_HOURS)
        try:
            return timedelta(hours=max(0.0, float(hours)))
        except (TypeError, ValueError):
            return timedelta(hours=DEFAULT_REFRESH_HOURS)

    async def refresh(self, toolkit_key: str, provider_key: str | None = None, force: bool = False) -> dict[str, Any]:
        provider = self._resolve_provider(provider_key)
        key = toolkit_key.strip().lower()
        if not key:
            raise ToolValidationError("toolkit_key is required")
        lock = self._locks.setdefault((provider.provider_key, key), asyncio.Lock())
        async with lock: 
            async with self._session_factory()() as session:
                synced_at = await self.synchronizer.toolkit_freshness(session, provider.provider_key, key)
                now = datetime.now(UTC)
                age = None if synced_at is None else now - synced_at
                limit = FORCE_MIN_AGE if force else self.max_age(provider)
                if age is not None and age < limit:
                    tool_log("DEBUG", "COMPLETED", "TOOLKIT_REFRESH", "tool.toolkit.fresh", provider.provider_key, key, int(age.total_seconds()))
                    return self._response("fresh", provider.provider_key, key, synced_at, None, now, provider)
            tool_log("INFO", "STARTED", "TOOLKIT_REFRESH", "tool.toolkit.started", provider.provider_key, key, force)
            started = time.perf_counter()
            try:
                async with self._session_factory()() as session:
                    result = await self.synchronizer.synchronize_toolkit(session, provider, key)
            except Exception as exc:
                tool_log("WARNING", "FAILURE", "TOOLKIT_REFRESH", "tool.toolkit.failed",provider.provider_key, key, f"{type(exc).__name__}: {str(exc)[:300]}")
                raise
            counts = result.counts()
            tool_log("INFO", "COMPLETED", "TOOLKIT_REFRESH", "tool.toolkit.completed",provider.provider_key, key, result.status, counts["inserted"], counts["updated"],counts["unchanged"], counts["deactivated"],context={"duration_s": round(time.perf_counter() - started, 1)})
            return self._response(result.status, provider.provider_key, key, result.synced_at, result.counts(), now, provider)

    def _response(self, status, provider_key, toolkit_key, synced_at, counts, now, provider) -> dict[str, Any]:
        return {
            "status": status, 
            "provider_key": provider_key,
            "toolkit_key": toolkit_key,
            "synced_at": synced_at,
            "next_refresh_at": synced_at + self.max_age(provider) if synced_at else None,
            "counts": counts,
        }


class ToolkitDirectoryService:
    """The app list: the provider's toolkit directory (always complete) merged with what is already in the database."""

    def __init__(self, registry: ToolProviderRegistry, catalog: ToolCatalogService):
        self.registry = registry
        self.catalog = catalog

    async def list(self, db, *, provider_key: str | None = None, search: str | None = None, enabled: bool | None = True):
        stored = await self.catalog.list_toolkits(db, provider_key=provider_key, search=None, enabled=enabled)
        merged: dict[tuple[str, str], dict[str, Any]] = {}
        if enabled is not False:
            for key, provider in self.registry.get_all().items():
                if provider_key and key != provider_key:
                    continue
                try:
                    infos = await provider.list_toolkits_info()
                except Exception: 
                    tool_log("WARNING", "FAILURE", "TOOLKIT_DIRECTORY", "tool.toolkit.directory.failed", key, exc_info=True)
                    continue
                for info in infos:
                    merged[(key, info["toolkit_key"])] = {
                        "provider_key": key, **info, "synced": False, "synced_at": None,
                    }
        for item in stored:
            slot = merged.get((item["provider_key"], item["toolkit_key"]))
            if slot is None:
                merged[(item["provider_key"], item["toolkit_key"])] = item
                continue
            slot.update(tool_count=item["tool_count"], synced=True, synced_at=item["synced_at"])
            for field in ("name", "description", "logo", "app_url", "category"):
                if not slot.get(field) or slot[field] == slot["toolkit_key"]:
                    slot[field] = item.get(field) or slot.get(field)
        term = (search or "").strip().casefold()
        rows = [row for row in merged.values() if not term or term in row["toolkit_key"].casefold() or term in (row.get("name") or "").casefold()]
        return sorted(rows, key=lambda row: (row.get("name") or row["toolkit_key"]).casefold())
