
from threading import RLock
from typing import Any
from modules.llm_providers.base import BaseLLMProvider, ProviderContext
from modules.llm_providers.loader import LoadedProvider, ProviderLoader
class ProviderRegistryError(Exception):
    pass
class ProviderRegistry:
    def __init__(self):
        self._providers: dict[str, LoadedProvider] = {}
        self._lock = RLock()
        self._initialized = False
    @property
    def initialized(self) -> bool:
        with self._lock:
            return self._initialized
    def register(self, provider: LoadedProvider) -> None:
        key = provider.key.upper()
        with self._lock:
            if key in self._providers:
                raise ProviderRegistryError(
                    f"Provider '{key}' is already registered"
                )
            self._providers[key] = provider
    def register_many(
        self,
        providers: dict[str, LoadedProvider]
    ) -> None:
        normalized = {
            key.upper(): provider
            for key, provider in providers.items()
        }
        with self._lock:
            duplicates = set(normalized).intersection(self._providers)
            if duplicates:
                raise ProviderRegistryError(
                    f"Providers already registered: {sorted(duplicates)}"
                )
            self._providers.update(normalized)
    def initialize(self, loader: ProviderLoader | None = None) -> None:
        provider_loader = loader or ProviderLoader()
        loaded = provider_loader.load_all()
        with self._lock:
            self._providers = loaded
            self._initialized = True
    def replace_all(
        self,
        providers: dict[str, LoadedProvider]
    ) -> None:
        normalized = {
            key.upper(): provider
            for key, provider in providers.items()
        }
        if len(normalized) != len(providers):
            raise ProviderRegistryError(
                "Duplicate provider keys in replacement registry"
            )
        with self._lock:
            self._providers = normalized
            self._initialized = True
    def get(self, provider_key: str) -> LoadedProvider:
        key = provider_key.upper()
        with self._lock:
            provider = self._providers.get(key)
        if provider is None:
            raise ProviderRegistryError(
                f"Provider '{key}' is not registered"
            )
        return provider
    def get_manifest(self, provider_key: str) -> dict[str, Any]:
        return self.get(provider_key).manifest
    def create(
        self,
        provider_key: str,
        context: ProviderContext
    ) -> BaseLLMProvider:
        provider = self.get(provider_key)
        if context.provider_key.upper() != provider.key:
            raise ProviderRegistryError(
                "Provider context key does not match requested provider"
            )
        return provider.create(context)
    def list_providers(
        self,
        include_deprecated: bool = False
    ) -> list[dict[str, Any]]:
        with self._lock:
            providers = list(self._providers.values())
        result = []
        for loaded in providers:
            manifest = loaded.manifest
            provider_data = manifest["provider"]
            if (
                not include_deprecated
                and provider_data.get("status") == "deprecated"
            ):
                continue
            result.append({
                "key": loaded.key,
                "name": provider_data["name"],
                "slug": provider_data["slug"],
                "description": provider_data["description"],
                "category": provider_data["category"],
                "status": provider_data["status"],
                "version": provider_data["version"],
                "capabilities": manifest.get("capabilities", {}),
                "ui": manifest.get("ui", {})
            })
        return sorted(result, key=lambda item: item["name"].lower())
    def has_provider(self, provider_key: str) -> bool:
        with self._lock:
            return provider_key.upper() in self._providers
    def count(self) -> int:
        with self._lock:
            return len(self._providers)
    def clear(self) -> None:
        with self._lock:
            self._providers.clear()
            self._initialized = False
    def health(self) -> dict[str, Any]:
        with self._lock:
            providers = list(self._providers.values())
            initialized = self._initialized
        return {
            "initialized": initialized,
            "provider_count": len(providers),
            "providers": sorted(
                provider.key for provider in providers
            )
        }
provider_registry = ProviderRegistry()
