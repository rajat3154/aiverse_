import asyncio
import os
import time
from typing import Any

from modules.tools.core.contracts import BaseToolProvider, ToolDefinition, ToolDiscoveryResult, ToolExecutionContext, ToolExecutionResult
from modules.tools.logs import tool_log
from modules.tools.credential_vault import CredentialUnavailable, fetch_secret
from modules.tools.providers.youtube.client import API_KEY_ENV, NO_KEY_TOOLS, load_specs, retrieve

TOOLKIT_KEY = "youtube"

_TOOLS = load_specs()


def _error(code: str, message: str) -> ToolExecutionResult:
    return ToolExecutionResult(success=False, error={"code": code, "message": message})


class YouTubeToolProvider(BaseToolProvider):
    """Read-only YouTube tools backed by the langchain-youtube retrievers.

    The YouTube Data API key is a server credential read from ``YOUTUBE_API_KEY`` (like ``COMPOSIO_API_KEY``);
    transcripts need no key.
    """

    async def discover_tools(self) -> ToolDiscoveryResult:
        tools = [
            ToolDefinition(
                external_tool_id=spec["id"],
                slug=spec["id"],
                name=spec["name"],
                description=spec["description"],
                category=spec["category"],
                toolkit_key=TOOLKIT_KEY,
                execution_type="native",
                input_schema={"type": "object", "properties": spec["properties"], "required": spec["required"], "additionalProperties": False},
                output_schema={"type": "object", "properties": {"documents": {"type": "array", "items": {"type": "object"}}, "count": {"type": "integer"}}},
                auth_requirements={"required": False, "credential": {"label": "YouTube API key", "identifier": "YOUTUBE_API_KEY", "required": spec["id"] not in NO_KEY_TOOLS}},
                metadata={
                    "read_only": True,
                    "requires_api_key": spec["id"] not in NO_KEY_TOOLS,
                    "toolkit_name": "YouTube",
                    "toolkit_description": "Search videos and read transcripts, playlists, video details and comments.",
                    "toolkit_logo": "https://cdn.simpleicons.org/youtube/FF0000",
                    "toolkit_app_url": "https://www.youtube.com",
                    "toolkit_auth_schemes": ["NO_AUTH"],
                    "toolkit_no_auth": True,
                },
                version=self.manifest.get("provider", {}).get("version"),
            )
            for spec in _TOOLS
        ]
        return ToolDiscoveryResult(tools=tools, complete=True)

    async def execute_tool(self, external_tool_id: str, arguments: dict[str, Any], context: ToolExecutionContext) -> ToolExecutionResult:
        if external_tool_id not in {spec["id"] for spec in _TOOLS}:
            tool_log("WARNING", "REJECTED", "EXECUTE", "tool.youtube.unknown", external_tool_id)
            return _error("unknown_tool", f"Unsupported YouTube tool: {external_tool_id}")
        credential_id = (context.metadata or {}).get("credential_id")
        api_key = None
        if credential_id and external_tool_id not in NO_KEY_TOOLS:
            try:
                api_key = await fetch_secret(context.user_id, str(credential_id))
            except CredentialUnavailable as exc:
                return _error("credential_unavailable", str(exc))
        api_key = api_key or os.getenv(API_KEY_ENV, "").strip() or None
        if external_tool_id not in NO_KEY_TOOLS and not api_key:
            tool_log("WARNING", "REJECTED", "EXECUTE", "tool.youtube.keymissing", external_tool_id)
            return _error("api_key_required", "Choose a YouTube API key credential to use this tool. Add one on the Credentials page first.")
        started = time.perf_counter()
        try:
            documents = await asyncio.to_thread(retrieve, external_tool_id, dict(arguments or {}), api_key)
        except ValueError as exc:
            tool_log("WARNING", "REJECTED", "EXECUTE", "tool.youtube.invalid", external_tool_id)
            return _error("invalid_arguments", str(exc))
        except ImportError:
            tool_log("ERROR", "FAILURE", "EXECUTE", "tool.youtube.package.missing")
            return _error("provider_unavailable", "The langchain-youtube package is not installed.")
        except Exception as exc:
            tool_log("ERROR", "FAILURE", "EXECUTE", "tool.youtube.failed", external_tool_id, type(exc).__name__)
            return _error("upstream_error", "YouTube request failed.")
        data = [{"content": getattr(doc, "page_content", str(doc)), "metadata": dict(getattr(doc, "metadata", None) or {})} for doc in documents]
        tool_log("INFO", "COMPLETED", "EXECUTE", "tool.youtube.completed", external_tool_id, len(data), int((time.perf_counter() - started) * 1000))
        return ToolExecutionResult(success=True, data={"documents": data, "count": len(data)})

    def health(self) -> dict[str, Any]:
        return {**super().health(), "configured": bool(os.getenv(API_KEY_ENV, "").strip())}
