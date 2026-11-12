
import hashlib
import json
from dataclasses import dataclass
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.llm_providers.loader import LoadedProvider
from modules.llm_providers.models import LLMProviderCatalog


@dataclass(slots=True)
class SynchronizationResult:
    total: int
    inserted: int
    updated: int
    unchanged: int

    def to_dict(self) -> dict[str, int]:
        return {
            "total": self.total,
            "inserted": self.inserted,
            "updated": self.updated,
            "unchanged": self.unchanged
        }


class ProviderSynchronizer:
    def __init__(self):
        self.catalog_model = LLMProviderCatalog

    @staticmethod
    def _prepare_provider(
        key: str,
        loaded: LoadedProvider
    ) -> dict[str, Any]:
        manifest = loaded.manifest
        provider = manifest["provider"]

        normalized_key = key.upper()

        if provider["key"] != normalized_key:
            raise ValueError(
                f"Provider key mismatch: expected '{normalized_key}', "
                f"received '{provider['key']}'"
            )

        manifest_json = json.dumps(
            manifest,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":")
        )

        manifest_hash = hashlib.sha256(
            manifest_json.encode("utf-8")
        ).hexdigest()

        status = provider["status"]

        return {
            "provider_key": normalized_key,
            "name": provider["name"],
            "slug": provider["slug"],
            "description": provider.get("description"),
            "category": provider["category"],
            "status": status,
            "manifest_version": provider["version"],
            "manifest_hash": manifest_hash,
            "manifest": manifest
        }

    async def synchronize(
        self,
        session: AsyncSession,
        providers: dict[str, LoadedProvider]
    ) -> SynchronizationResult:
        prepared = [
            self._prepare_provider(key, loaded)
            for key, loaded in sorted(providers.items())
        ]

        keys = [item["provider_key"] for item in prepared]

        if len(keys) != len(set(keys)):
            raise ValueError("Duplicate provider keys detected")

        inserted = 0
        updated = 0
        unchanged = 0

        async with session.begin():
            model = self.catalog_model

            existing_result = await session.scalars(
                select(model)
                .where(model.provider_key.in_(keys))
                .with_for_update()
            ) if keys else None

            existing_providers = {
                item.provider_key: item
                for item in existing_result.all()
            } if existing_result else {}

            for item in prepared:
                key = item["provider_key"]
                existing = existing_providers.get(key)

                if existing is None:
                    session.add(
                        model(
                            **item,
                            enabled=item["status"] in ("active", "beta")
                        )
                    )
                    inserted += 1
                    continue

                if existing.manifest_hash == item["manifest_hash"]:
                    unchanged += 1
                    continue

                existing.name = item["name"]
                existing.slug = item["slug"]
                existing.description = item["description"]
                existing.category = item["category"]
                existing.status = item["status"]
                existing.manifest_version = item["manifest_version"]
                existing.manifest_hash = item["manifest_hash"]
                existing.manifest = item["manifest"]
                existing.updated_at = func.now()

                # Deprecated or otherwise inactive providers must be disabled.
                # Active/beta providers retain their existing enabled setting.
                if item["status"] not in ("active", "beta"):
                    existing.enabled = False

                updated += 1

            await session.flush()

        return SynchronizationResult(
            total=len(prepared),
            inserted=inserted,
            updated=updated,
            unchanged=unchanged
        )
