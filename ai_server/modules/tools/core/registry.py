from typing import Iterable
from modules.tools.core.contracts import BaseToolProvider
from modules.tools.logs import tool_log
from modules.tools.core.exceptions import DuplicateToolProviderError,ToolProviderNotFoundError

class ToolProviderRegistry:
    def __init__(self):
        self._providers: dict[str, BaseToolProvider] = {}

    def register(self,provider: BaseToolProvider,replace: bool = False,) -> None:
        key = provider.provider_key.lower()
        if not key:
            raise ValueError("Provider key cannot be empty")
        if key in self._providers and not replace:
            raise DuplicateToolProviderError(f"Provider '{key}' is already registered")
        self._providers[key] = provider

    def unregister(self, provider_key: str) -> bool:
        return self._providers.pop(provider_key.lower(), None) is not None

    def get(self, provider_key: str) -> BaseToolProvider:
        key = provider_key.lower()
        provider = self._providers.get(key)
        if provider is None:
            raise ToolProviderNotFoundError(f"Provider '{key}' is not registered")
        return provider

    def get_all(self) -> dict[str, BaseToolProvider]:
        return self._providers.copy()

    def keys(self) -> list[str]:
        return sorted(self._providers.keys())

    def replace_all(self,providers: Iterable[BaseToolProvider]) -> None:
        replacement: dict[str, BaseToolProvider] = {}
        for provider in providers:
            key = provider.provider_key.lower()
            if key in replacement:
                raise DuplicateToolProviderError(f"Duplicate provider key '{key}'")
            replacement[key] = provider
        self._providers = replacement

    def health(self) -> dict[str, dict]:
        return {
            key: provider.health()
            for key, provider in sorted(self._providers.items())
        }

    async def close_all(self) -> None:
        """Close every provider, continuing past individual failures so shutdown always completes."""
        for key, provider in list(self._providers.items()):
            try:
                await provider.close()
            except Exception as exc: 
                tool_log("WARNING", "FAILURE", "PROVIDER_CLOSE", "tool.provider.close.failed", key, exc_info=True)

    def clear(self) -> None:
        self._providers = {}

    def __len__(self) -> int:
        return len(self._providers)