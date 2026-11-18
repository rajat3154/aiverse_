
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Mapping, Sequence


@dataclass(slots=True)
class ToolDefinition:
    external_tool_id: str
    slug: str
    name: str
    execution_type: str
    description: str | None = None
    category: str | None = None
    toolkit_key: str | None = None
    connector_key: str | None = None
    input_schema: dict[str, Any] = field(default_factory=dict)
    output_schema: dict[str, Any] = field(default_factory=dict)
    auth_requirements: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
    version: str | None = None
    status: str = "active"
    enabled: bool = True

    def __post_init__(self) -> None:
        for field_name in ("external_tool_id", "slug", "name", "execution_type"):
            value = getattr(self, field_name)
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"{field_name} must be a non-empty string")


@dataclass(slots=True)
class ToolDiscoveryResult:
    tools: Sequence[ToolDefinition]
    complete: bool
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ToolExecutionContext:
    user_id: str
    services: Mapping[str, Any] = field(default_factory=dict)
    request_id: str | None = None
    metadata: Mapping[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ToolExecutionResult:
    success: bool
    data: Any = None
    error: dict[str, Any] | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


class BaseToolProvider(ABC):
    def __init__(
        self,
        manifest: dict[str, Any],
        context: ToolExecutionContext | None = None,
    ):
        self.manifest = manifest
        self.context = context
        provider = manifest.get("provider", {})
        self.provider_key = provider.get("key", "").lower()
        self.provider_name = provider.get("name", self.provider_key)
        if not self.provider_key:
            raise ValueError("Provider manifest must define provider.key")

    @abstractmethod
    async def discover_tools(self) -> ToolDiscoveryResult:
        """Return discovered tools and explicitly indicate catalog completeness."""

    @abstractmethod
    async def execute_tool(
        self,
        external_tool_id: str,
        arguments: dict[str, Any],
        context: ToolExecutionContext,
    ) -> ToolExecutionResult:
        """Execute one provider-specific tool."""

    async def test_tool(
        self,
        external_tool_id: str,
        arguments: dict[str, Any],
        context: ToolExecutionContext,
    ) -> ToolExecutionResult:
        return await self.execute_tool(
            external_tool_id=external_tool_id,
            arguments=arguments,
            context=context,
        )

    supports_toolkit_discovery: bool = False

    async def list_toolkits_info(self) -> list[dict[str, Any]]:
        """Lightweight directory of the provider's toolkits (name, logo, description, tool count). Cheap and cacheable."""
        return []

    async def discover_toolkit(self, toolkit_key: str) -> ToolDiscoveryResult:
        """Every tool of ONE toolkit. `complete` follows the same rule as discover_tools()."""
        raise NotImplementedError(f"Provider '{self.provider_key}' cannot discover a single toolkit")

    async def check_availability(self) -> None:
        """Make one cheap call to prove the provider is reachable. Raise on failure. Default: nothing to check."""
        return None

    async def close(self) -> None:
        """Release clients and connections. Called once at application shutdown."""
        return None

    def health(self) -> dict[str, Any]:
        return {
            "provider_key": self.provider_key,
            "provider_name": self.provider_name,
            "status": "registered",
        }
