import asyncio
import time
from typing import Any
from modules.tools.core.contracts import BaseToolProvider,ToolDefinition,ToolDiscoveryResult,ToolExecutionContext,ToolExecutionResult
from modules.tools.core.exceptions import ToolDiscoveryError, ToolkitNotFoundError
from modules.tools.logs import tool_log
from modules.tools.providers.composio.client import ComposioSDKClient
from modules.tools.providers.composio.errors import classify


class ComposioToolProvider(BaseToolProvider):
    supports_toolkit_discovery = True
    DIRECTORY_TTL_SECONDS = 24 * 60 * 60

    def __init__(self, manifest: dict[str, Any], context=None):
        super().__init__(manifest=manifest, context=context)
        self._directory: dict[str, dict[str, Any]] = {}
        self._directory_at: float | None = None
        self._directory_lock = asyncio.Lock()
        config = manifest.get("configuration", {})
        self.page_size = int(config.get("page_size", 100))
        self.max_pages = int(config.get("max_pages", 1000))
        self.include_deprecated = bool(config.get("include_deprecated", True))
        self.toolkit_type = config.get("toolkit_type", "all")
        self.fetch_concurrency = max(1, int(config.get("fetch_concurrency", 4)))
        self._client: ComposioSDKClient | None = None

    def _get_client(self, context: ToolExecutionContext | None = None):
        if context:
            injected = (context.services.get("composio_client")or context.services.get("composio"))
            if injected is not None:
                return injected
        if self._client is None:
            self._client = ComposioSDKClient()
        return self._client

    @staticmethod
    def _dump(value: Any) -> Any:
        if hasattr(value, "model_dump"):
            return value.model_dump(mode="json", exclude_none=True)
        if isinstance(value, dict):
            return value
        return {}

    @staticmethod
    def _schema(parameters: Any) -> dict[str, Any]:
        if not isinstance(parameters, dict):
            return {"type": "object", "properties": {}}
        if "properties" in parameters and parameters.get("type") == "object":
            return parameters
        properties = {}
        required = []
        for name, definition in parameters.items():
            if isinstance(definition, dict):
                properties[name] = definition
                if definition.get("required") is True:
                    required.append(name)
            else:
                properties[name] = {"description": str(definition)}
        schema = {"type": "object", "properties": properties}
        if required:
            schema["required"] = required
        return schema

    def _page_logger(self, scope: str):
        """Per-page progress at DEBUG: invaluable when diagnosing a slow run, too chatty for normal operation."""
        return lambda page, count, more: tool_log("DEBUG", "COMPLETED", "DISCOVERY_PAGE", "tool.discovery.page", self.provider_key, scope, page, count, more )

    async def _collect(self, fetch, log, **options) -> tuple[list[dict[str, Any]], bool]:
        """Read every page of one listing. Returns (items, complete); complete is False only if max_pages cut it short."""
        cursor = None
        items: list[dict[str, Any]] = []
        for page_number in range(1, self.max_pages + 1):
            response = self._dump(await fetch(cursor=cursor, limit=self.page_size, **options))
            batch = response.get("items") or []
            cursor = response.get("next_cursor")
            log(page_number, len(batch), bool(cursor))
            items.extend(batch)
            if not cursor:
                return items, True
        return items, False

    @staticmethod
    def _category(toolkit: dict[str, Any]) -> str | None:
        categories = (toolkit.get("meta") or {}).get("categories") or []
        first = categories[0] if categories else None
        if isinstance(first, dict):
            return first.get("name") or first.get("slug") or first.get("id")
        return first

    async def _toolkit_directory(self, force: bool = False) -> dict[str, dict[str, Any]]:
        """Composio's toolkit list (about one request per 100 toolkits), cached for a day. Stale data beats an outage."""
        async with self._directory_lock:
            age = None if self._directory_at is None else time.monotonic() - self._directory_at
            if self._directory and not force and age is not None and age < self.DIRECTORY_TTL_SECONDS:
                return self._directory
            try:
                items, _ = await self._collect(
                    self._get_client().list_toolkits,
                    self._page_logger("toolkits"),
                    include_deprecated=self.include_deprecated,
                    toolkit_type=self.toolkit_type,
                )
            except Exception as exc:
                if self._directory:
                    tool_log("WARNING", "FAILURE", "DIRECTORY", "tool.directory.stale", self.provider_key, type(exc).__name__)
                    return self._directory
                raise (classify(exc) or ToolDiscoveryError(f"Could not list Composio toolkits: {exc}")) from exc
            self._directory = {item["slug"].lower(): item for item in items if item.get("slug")}
            self._directory_at = time.monotonic()
            tool_log("INFO", "COMPLETED", "DIRECTORY", "tool.directory.refreshed", self.provider_key, len(self._directory))
            return self._directory

    @staticmethod
    def _toolkit_summary(slug: str, item: dict[str, Any]) -> dict[str, Any]:
        meta = item.get("meta") or {}
        categories = meta.get("categories") or []
        first = categories[0] if categories else None
        return {
            "toolkit_key": slug,
            "name": item.get("name") or slug,
            "description": meta.get("description"),
            "logo": meta.get("logo"),
            "app_url": meta.get("app_url"),
            "category": (first.get("name") or first.get("slug")) if isinstance(first, dict) else first,
            "tool_count": int(meta["tools_count"]) if meta.get("tools_count") is not None else 0,
            "auth_schemes": list(item.get("auth_schemes") or item.get("composio_managed_auth_schemes") or []),
            "no_auth": bool(item.get("no_auth", False)),
        }

    async def list_toolkits_info(self) -> list[dict[str, Any]]:
        directory = await self._toolkit_directory()
        return [self._toolkit_summary(slug, item) for slug, item in directory.items()]

    async def discover_toolkit(self, toolkit_key: str) -> ToolDiscoveryResult:
        key = toolkit_key.strip().lower()
        directory = await self._toolkit_directory()
        if key not in directory:
            raise ToolkitNotFoundError(f"Toolkit '{key}' was not found at the provider")
        started = time.perf_counter()
        tool_log("INFO", "STARTED", "DISCOVERY", "tool.discovery.toolkit.started", self.provider_key, key)
        try:
            items, complete = await self._collect(
                self._get_client().list_tools,
                self._page_logger(key),
                toolkit_slug=key,
                include_deprecated=self.include_deprecated,
            )
        except Exception as exc:
            raise (classify(exc) or ToolDiscoveryError(f"Could not read tools for '{key}': {exc}")) from exc
        tools: list[ToolDefinition] = []
        seen: set[str] = set()
        for item in items:
            definition = self._to_definition(item, {key: directory[key]})
            if definition is None or definition.slug in seen:
                continue
            seen.add(definition.slug)
            tools.append(definition)
        tool_log("INFO", "COMPLETED", "DISCOVERY", "tool.discovery.toolkit.completed",self.provider_key, key, len(tools), complete, round(time.perf_counter() - started, 1))
        return ToolDiscoveryResult(tools=tools, complete=complete, metadata={"toolkit": key})

    async def discover_tools(self) -> ToolDiscoveryResult:
        client = self._get_client()
        discovered: list[ToolDefinition] = []
        seen: set[str] = set()
        complete = True

        try:
            run_started = time.perf_counter()
            tool_log("INFO", "STARTED", "DISCOVERY", "tool.discovery.started", self.provider_key)
            toolkit_items, toolkits_complete = await self._collect(
                client.list_toolkits,
                self._page_logger("toolkits"),
                include_deprecated=self.include_deprecated,
                toolkit_type=self.toolkit_type,
            )
            complete = toolkits_complete
            toolkits = {item["slug"].lower(): item for item in toolkit_items if item.get("slug")}
            tool_log("INFO", "COMPLETED", "DISCOVERY", "tool.discovery.toolkits", self.provider_key, len(toolkits))

            semaphore = asyncio.Semaphore(self.fetch_concurrency)
            done = 0

            async def fetch_toolkit(toolkit_slug: str):
                nonlocal done
                async with semaphore:
                    tool_log("DEBUG", "STARTED", "DISCOVERY", "tool.discovery.toolkit.started", self.provider_key, toolkit_slug)
                    result = await self._collect(
                        client.list_tools,
                        self._page_logger(toolkit_slug),
                        toolkit_slug=toolkit_slug,
                        include_deprecated=self.include_deprecated,
                    )
                    done += 1
                    if done % 100 == 0: 
                        tool_log("INFO", "COMPLETED", "DISCOVERY", "tool.discovery.progress", self.provider_key, done, len(toolkits))
                    return result

            try:
                async with asyncio.TaskGroup() as group:
                    tasks = [group.create_task(fetch_toolkit(slug)) for slug in toolkits]
            except ExceptionGroup as group_error:
                raise group_error.exceptions[0] from None
            for toolkit_slug, task in zip(toolkits, tasks):
                tool_items, tools_complete = task.result()
                complete = complete and tools_complete
                for item in tool_items:
                    definition = self._to_definition(item, toolkits)
                    if definition is None or definition.slug in seen:
                        continue
                    seen.add(definition.slug)
                    discovered.append(definition)
        except Exception as exc:
            tool_log("ERROR", "FAILURE", "DISCOVERY", "tool.discovery.failed", self.provider_key, f"{type(exc).__name__}: {str(exc)[:300]}")
            raise ToolDiscoveryError(f"Composio catalog discovery failed: {exc}") from exc

        tool_log("INFO", "COMPLETED", "DISCOVERY", "tool.discovery.completed",self.provider_key, len(discovered), complete, round(time.perf_counter() - run_started, 1),context={"fetch_concurrency": self.fetch_concurrency})
        return ToolDiscoveryResult(tools=discovered,complete=complete,metadata={"toolkits": len(toolkits), "page_size": self.page_size})

    def _to_definition(self, item: dict[str, Any], toolkits: dict[str, dict[str, Any]]) -> ToolDefinition | None:
        slug = item.get("slug")
        if not isinstance(slug, str) or not slug.strip():
            return None
        toolkit = item.get("toolkit") or {}
        toolkit_slug = (toolkit.get("slug") or "").lower() or None
        toolkit_info = toolkits.get(toolkit_slug or "", {})
        no_auth = bool(item.get("no_auth", False))
        return ToolDefinition(
            external_tool_id=slug,
            slug=slug.lower(),
            name=item.get("name") or slug,
            execution_type="hosted",
            description=item.get("human_description") or item.get("description"),
            category=self._category(toolkit_info),
            toolkit_key=toolkit_slug,
            connector_key=self.provider_key,
            input_schema=self._schema(item.get("input_parameters")),
            output_schema=self._schema(item.get("output_parameters")),
            auth_requirements={
                "required": not no_auth,
                "scopes": item.get("scopes") or [],
            },
            metadata={
                "tags": item.get("tags") or [],
                "toolkit_name": toolkit.get("name") or toolkit_info.get("name"),
                "toolkit_logo": toolkit.get("logo") or (toolkit_info.get("meta") or {}).get("logo"),
                "toolkit_description": (toolkit_info.get("meta") or {}).get("description"),
                "toolkit_app_url": (toolkit_info.get("meta") or {}).get("app_url"),
                "toolkit_auth_schemes": toolkit_info.get("auth_schemes") or toolkit_info.get("composio_managed_auth_schemes") or [],
                "toolkit_no_auth": bool(toolkit_info.get("no_auth", False)),
                "available_versions": item.get("available_versions") or [],
            },
            version=str(item["version"]) if item.get("version") else None,
            status="deprecated" if item.get("is_deprecated") else "active",
            enabled=not item.get("is_deprecated", False),
        )

    async def execute_tool(self,external_tool_id: str,arguments: dict[str, Any],context: ToolExecutionContext) -> ToolExecutionResult:
        if not external_tool_id or not external_tool_id.strip():
            return ToolExecutionResult(success=False,error={"type": "validation", "message": "external_tool_id is required"},)
        if not context or not context.user_id or not str(context.user_id).strip():
            return ToolExecutionResult(success=False,error={"type": "validation", "message": "An authenticated user is required"})
        if not isinstance(arguments, dict):
            return ToolExecutionResult(success=False,error={"type": "validation", "message": "arguments must be an object"})

        client = self._get_client(context)
        try:
            response = await client.execute_tool(external_tool_id,arguments,user_id=str(context.user_id),connected_account_id=context.metadata.get("connected_account_id"))
        except Exception as exc:
            infrastructure_error = classify(exc)
            if infrastructure_error is not None:
                tool_log("WARNING", "FAILURE", "EXECUTE", "tool.provider.classified", self.provider_key, type(infrastructure_error).__name__)
                raise infrastructure_error from exc
            return ToolExecutionResult(success=False,error={"type": type(exc).__name__, "message": str(exc)[:500]}, metadata={"provider": self.provider_key, "tool": external_tool_id})

        data = self._dump(response) if not isinstance(response, (list, str, int, float, bool)) else response
        successful = data.get("successful", True) if isinstance(data, dict) else True
        error = data.get("error") if isinstance(data, dict) else None
        return ToolExecutionResult(
            success=bool(successful) and not error,
            data=data.get("data", data) if isinstance(data, dict) else data,
            error={"type": "tool_error", "message": str(error)} if error else None,
            metadata={"provider": self.provider_key, "tool": external_tool_id},
        )

    async def check_availability(self) -> None:
        """One-toolkit listing: proves credentials, network and the Composio API are all working."""
        client = self._get_client()
        try:
            await client.list_toolkits(limit=1)
        except Exception as exc:
            raise (classify(exc) or exc) from exc

    async def close(self) -> None:
        if self._client is not None:
            await self._client.close()
            self._client = None

    def health(self) -> dict[str, Any]:
        import os
        return {
            **super().health(),
            "configured": bool(os.getenv("COMPOSIO_API_KEY")),
        }
