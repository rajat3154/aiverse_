
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.llm_providers.base import (
    BaseLLMProvider,
    ProviderConfigurationError,
    ProviderContext
)
from modules.llm_providers.models import LLMProviderCatalog
from modules.llm_providers.registry import (
    ProviderRegistry,
    ProviderRegistryError,
    provider_registry
)


class LLMProviderFactory:
    def __init__(
        self,
        registry: ProviderRegistry | None = None
    ):
        self.registry = registry or provider_registry

    async def create(
        self,
        session: AsyncSession,
        provider_key: str,
        configuration: dict[str, Any] | None = None,
        credential: dict[str, Any] | None = None,
        user_id: str | None = None,
        timeout: float = 60.0
    ) -> BaseLLMProvider:
        key = provider_key.strip().upper()

        if not key:
            raise ProviderConfigurationError(
                "Provider key cannot be empty."
            )

        enabled = await session.scalar(
            select(LLMProviderCatalog.enabled)
            .where(LLMProviderCatalog.provider_key == key)
        )

        if enabled is None:
            raise ProviderConfigurationError(
                f"Provider '{key}' is not registered in the catalog."
            )

        if not enabled:
            raise ProviderConfigurationError(
                f"Provider '{key}' is currently disabled."
            )

        try:
            loaded_provider = self.registry.get(key)
        except ProviderRegistryError as error:
            raise ProviderConfigurationError(
                f"Provider '{key}' is not loaded in the registry."
            ) from error

        context = ProviderContext(
            provider_key=key,
            configuration=configuration or {},
            credential=credential or {},
            user_id=user_id,
            timeout=timeout
        )

        try:
            instance = loaded_provider.create(context)
        except Exception as error:
            raise ProviderConfigurationError(
                f"Failed to initialize provider '{key}'."
            ) from error

        return instance


llm_provider_factory = LLMProviderFactory()
