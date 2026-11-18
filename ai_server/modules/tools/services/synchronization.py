from typing import Any
from modules.tools.catalog.synchronizer import ToolCatalogSynchronizer
from modules.tools.core.registry import ToolProviderRegistry
from modules.tools.core.exceptions import ToolProviderNotFoundError
from configurations.databases.database import AsyncSessionLocal

class ToolSynchronizationService:
    def __init__(self,registry: ToolProviderRegistry,synchronizer: ToolCatalogSynchronizer | None = None,):
        self.registry = registry
        self.synchronizer = synchronizer or ToolCatalogSynchronizer()

    async def sync_provider(self,provider_key: str,trigger_type: str = "manual",allow_empty_catalog: bool = False) -> dict[str, Any]:
        provider = self.registry.get(provider_key)
        async with AsyncSessionLocal() as session:
            result = await self.synchronizer.synchronize(
                session=session,
                provider=provider,
                trigger_type=trigger_type,
                allow_empty_catalog=allow_empty_catalog,
            )
        return result.to_dict()

    async def sync_all(self,trigger_type: str = "manual",allow_empty_catalog: bool = False,) -> dict[str, Any]:
        results = []
        failures = []
        for provider_key in self.registry.keys():
            try:
                result = await self.sync_provider(provider_key=provider_key,trigger_type=trigger_type,allow_empty_catalog=allow_empty_catalog)
                results.append(result)
            except Exception as exc:
                failures.append({
                    "provider_key": provider_key,
                    "error_type": type(exc).__name__,
                    "message": str(exc)[:2000],
                })
        return {
            "status": (
                "failed" if failures and not results
                else "partial" if failures
                else "success"
            ),
            "provider_count": len(results) + len(failures),
            "successful_count": len(results),
            "failed_count": len(failures),
            "discovered": sum(item["discovered"] for item in results),
            "inserted": sum(item["inserted"] for item in results),
            "updated": sum(item["updated"] for item in results),
            "unchanged": sum(item["unchanged"] for item in results),
            "deactivated": sum(item["deactivated"] for item in results),
            "results": results,
            "failures": failures,
        }

tool_synchronization_service = None
