import asyncio
from typing import Any

from modules.database_toolbox.discovery import discover_upstream_sources
from modules.database_toolbox.logs import toolbox_log
from modules.database_toolbox.sources import all_sources, set_upstream, upstream_commit
from modules.tools.core.contracts import BaseToolProvider, ToolDefinition, ToolDiscoveryResult, ToolExecutionContext, ToolExecutionResult

TOOLKIT_KEY = "mcp-toolbox"
DISCOVERY_TIMEOUT_SECONDS = 20


class McpToolboxProvider(BaseToolProvider):
    """Publishes the database sources as catalog entries. Connections are managed by /api/database-connections.

    The connection fields and documentation pages are read from the official MCP Toolbox repository when it is
    reachable, and from the bundled snapshot of it otherwise. Names, categories, descriptions and logos come from
    ``sources.py``.
    """

    async def _upstream(self) -> tuple[str | None, dict[str, dict[str, Any]]]:
        try:
            return await asyncio.wait_for(asyncio.to_thread(discover_upstream_sources), timeout=DISCOVERY_TIMEOUT_SECONDS)
        except Exception as exc: 
            toolbox_log("WARNING", "FAILURE", "DISCOVER", "tool.toolbox.discovery.unavailable", type(exc).__name__)
            return None, {}

    async def discover_tools(self) -> ToolDiscoveryResult:
        commit, upstream = await self._upstream()
        if upstream:
            set_upstream(commit, upstream) 
        commit = commit or upstream_commit()
        tools = [
            ToolDefinition(
                external_tool_id=source.slug,
                slug=source.slug,
                name=source.name,
                description=source.description,
                category=source.category,
                toolkit_key=TOOLKIT_KEY,
                execution_type="database_connection",
                input_schema=source.input_schema(),
                auth_requirements={"required": False},
                metadata=self._metadata(source, commit, bool(upstream)),
                version=commit if source.fields_documented else None,
            )
            for source in all_sources()
        ]
        return ToolDiscoveryResult(tools=tools, complete=True)

    @staticmethod
    def _metadata(source, commit: str | None, live: bool) -> dict[str, Any]:
        metadata = source.metadata()
        metadata["metadata_source"] = ("official_documentation" if live else "bundled_snapshot") if source.fields_documented else "bundled"
        if source.fields_documented:
            metadata["upstream_commit"] = commit
        return metadata

    async def execute_tool(self, external_tool_id: str, arguments: dict[str, Any], context: ToolExecutionContext) -> ToolExecutionResult:
        return ToolExecutionResult(
            success=False,
            error={"code": "not_executable", "message": "Database sources are connected from the MCP Toolbox page, not executed."},
        )
