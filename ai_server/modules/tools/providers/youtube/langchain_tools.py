import asyncio
import json
import os
from typing import Any

from langchain_core.tools import StructuredTool

from modules.tools.providers.youtube.client import API_KEY_ENV, NO_KEY_TOOLS, load_specs, retrieve


def _make_tool(spec: dict[str, Any], api_key: str | None) -> StructuredTool:
    tool_id = spec["id"]
    schema = {"type": "object", "properties": spec["properties"], "required": spec["required"], "additionalProperties": False}
    def run(**arguments: Any) -> str:
        key = api_key or os.getenv(API_KEY_ENV, "").strip() or None
        if tool_id not in NO_KEY_TOOLS and not key:
            raise ValueError(f"{API_KEY_ENV} is not configured.")
        documents = retrieve(tool_id, arguments, key)
        return json.dumps([{"content": doc.page_content, "metadata": dict(doc.metadata or {})} for doc in documents], default=str)

    async def arun(**arguments: Any) -> str:
        return await asyncio.to_thread(run, **arguments)
    return StructuredTool(name=tool_id, description=spec["description"], args_schema=schema, func=run, coroutine=arun)


def build_youtube_tools(api_key: str | None = None) -> list[StructuredTool]:
    """All five tools. Pass ``api_key`` to override ``YOUTUBE_API_KEY``; transcripts never need one."""
    return [_make_tool(spec, api_key) for spec in load_specs()]
