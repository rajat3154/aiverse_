
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator, Mapping, Sequence
from dataclasses import dataclass, field
from typing import Any
@dataclass(slots=True)
class ProviderContext:
    provider_key: str
    configuration: dict[str, Any] = field(default_factory=dict)
    credential: Mapping[str, Any] = field(default_factory=dict)
    user_id: str | None = None
    timeout: float = 60.0
@dataclass(slots=True)
class ProviderModel:
    id: str
    name: str
    description: str | None = None
    capabilities: dict[str, bool] = field(default_factory=dict)
    context_window: int | None = None
    max_output_tokens: int | None = None
    input_modalities: list[str] = field(default_factory=list)
    output_modalities: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "capabilities": self.capabilities,
            "context_window": self.context_window,
            "max_output_tokens": self.max_output_tokens,
            "input_modalities": self.input_modalities,
            "output_modalities": self.output_modalities,
            "metadata": self.metadata
        }
@dataclass(slots=True)
class ProviderChatRequest:
    model: str
    messages: Sequence[Mapping[str, Any]]
    parameters: dict[str, Any] = field(default_factory=dict)
    stream: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)
@dataclass(slots=True)
class ProviderChatResponse:
    content: str
    model: str
    provider: str
    usage: dict[str, Any] = field(default_factory=dict)
    finish_reason: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
@dataclass(slots=True)
class ProviderEmbeddingResponse:
    embeddings: list[list[float]]
    model: str
    provider: str
    usage: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
class ProviderError(Exception):
    def __init__(
        self,
        message: str,
        code: str = "PROVIDER_ERROR",
        retryable: bool = False,
        details: dict[str, Any] | None = None
    ):
        super().__init__(message)
        self.code = code
        self.retryable = retryable
        self.details = details or {}
class ProviderAuthenticationError(ProviderError):
    def __init__(self, message: str = "Provider authentication failed"):
        super().__init__(
            message=message,
            code="AUTHENTICATION_FAILED",
            retryable=False
        )
class ProviderConfigurationError(ProviderError):
    def __init__(self, message: str, details: dict[str, Any] | None = None):
        super().__init__(
            message=message,
            code="INVALID_CONFIGURATION",
            retryable=False,
            details=details
        )
class ProviderModelNotFoundError(ProviderError):
    def __init__(self, model: str):
        super().__init__(
            message=f"Model '{model}' was not found or is unavailable",
            code="MODEL_NOT_FOUND",
            retryable=False,
            details={"model": model}
        )
class ProviderOperationNotSupportedError(ProviderError):
    def __init__(self, operation: str):
        super().__init__(
            message=f"Provider does not support operation: {operation}",
            code="OPERATION_NOT_SUPPORTED",
            retryable=False,
            details={"operation": operation}
        )
class BaseLLMProvider(ABC):
    def __init__(
        self,
        context: ProviderContext,
        manifest: dict[str, Any]
    ):
        self.context = context
        self.manifest = manifest
        self.provider_key = context.provider_key.upper()
        self.configuration = context.configuration
        self.credential = context.credential
    @abstractmethod
    async def validate_credentials(self) -> bool:
        """Validate the credentials supplied through the credential service."""
        raise NotImplementedError
    @abstractmethod
    async def discover_models(self) -> list[ProviderModel]:
        """Discover and return normalized models supported by this provider."""
        raise NotImplementedError
    @abstractmethod
    async def test_connection(self, model: str | None = None) -> bool:
        """Verify that the provider can successfully communicate with its API."""
        raise NotImplementedError
    @abstractmethod
    def create_model(
        self,
        model: str,
        parameters: dict[str, Any] | None = None
    ) -> Any:
        """Create and return the provider's chat model instance."""
        raise NotImplementedError
    async def chat(
        self,
        request: ProviderChatRequest
    ) -> ProviderChatResponse:
        raise ProviderOperationNotSupportedError("chat")
    async def stream(
        self,
        request: ProviderChatRequest
    ) -> AsyncIterator[Any]:
        raise ProviderOperationNotSupportedError("streaming")
        yield
    async def create_embeddings(
        self,
        texts: Sequence[str],
        model: str,
        parameters: dict[str, Any] | None = None
    ) -> ProviderEmbeddingResponse:
        raise ProviderOperationNotSupportedError("embeddings")
    def get_supported_operations(self) -> dict[str, bool]:
        operations = self.manifest.get("operations", {})
        return {
            name: bool(definition.get("enabled", False))
            for name, definition in operations.items()
            if isinstance(definition, dict)
        }
    def get_manifest_capabilities(self) -> dict[str, bool]:
        capabilities = self.manifest.get("capabilities", {})
        return {
            name: bool(value)
            for name, value in capabilities.items()
            if isinstance(value, bool)
        }
