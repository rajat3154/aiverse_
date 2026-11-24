import asyncio
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from configurations.databases.database import get_db
from modules.authentication import get_current_user_id, require_gateway_secret
from modules.integrations.container import get_connection_service
from modules.integrations.services.connections import ConnectionService
from modules.tools.errors import handle_tool_errors
from modules.tools.logs import tool_log
from modules.tools.schemas import (
    CategorySummaryResponse,
    GlobalSynchronizationResponse,
    HealthResponse,
    HistoryListResponse,
    ProviderResponse,
    SynchronizationRequest,
    TestHistoryResponse,
    ToolDetailResponse,
    ToolExecutionRequest,
    ToolExecutionResponse,
    ToolListResponse,
    ToolResponse,
    ToolTestRequest,
    ToolTestResponse,
    ToolkitRefreshRequest,
    ToolkitRefreshResponse,
    ToolkitSummaryResponse,
    UserHistoryResponse,
)
from modules.tools.services.accounts import ToolAccountResolver
from modules.tools.services.catalog import tool_catalog_service
from modules.tools.services.execution import ToolExecutionService
from modules.tools.services.history import tool_history_service
from modules.tools.services.synchronization import ToolSynchronizationService
from modules.tools.services.toolkits import ToolkitDirectoryService, ToolkitRefreshService

router = APIRouter(prefix="/api/tools",tags=["Tools"],dependencies=[Depends(require_gateway_secret), Depends(get_current_user_id)])
PROBE_TIMEOUT_SECONDS = 10

def get_registry(request: Request):
    registry = getattr(request.app.state, "tool_provider_registry", None)
    if registry is None:
        raise HTTPException(status_code=503,detail={"code": "provider_unavailable", "message": "Tool providers have not been loaded yet"})
    return registry


def get_execution_service(registry=Depends(get_registry),connections: ConnectionService = Depends(get_connection_service)) -> ToolExecutionService:
    return ToolExecutionService(registry, ToolAccountResolver(connections))

def get_sync_service(registry=Depends(get_registry)) -> ToolSynchronizationService:
    return ToolSynchronizationService(registry)

_refresh_services: dict[int, ToolkitRefreshService] = {}


def get_refresh_service(registry=Depends(get_registry)) -> ToolkitRefreshService:
    return _refresh_services.setdefault(id(registry), ToolkitRefreshService(registry))


def _schema_summary(tool) -> dict[str, Any]:
    schema = tool.input_schema or {}
    return {
        "requires_connection": bool((tool.auth_requirements or {}).get("required", False)),
        "required_parameters": list(schema.get("required") or []),
        "parameter_count": len(schema.get("properties") or {}),
    }


_DISPLAY_KEYS = ("logo", "documentation_url", "default_port", "requires_secret")


def _summary(tool, provider) -> dict[str, Any]:
    return {
        "id": tool.id,
        "provider_key": provider.provider_key,
        "external_tool_id": tool.external_tool_id,
        "slug": tool.slug,
        "name": tool.name,
        "description": tool.description,
        "category": tool.category,
        "toolkit_key": tool.toolkit_key,
        "execution_type": tool.execution_type,
        "version": tool.version,
        "status": tool.status,
        "enabled": tool.enabled,
        "last_seen_at": tool.last_seen_at,
        "display": {key: value for key, value in (tool.tool_metadata or {}).items() if key in _DISPLAY_KEYS},
        **_schema_summary(tool),
    }


def _execution_response(result) -> ToolExecutionResponse:
    return ToolExecutionResponse(success=result.success, data=result.data, error=result.error, metadata=result.metadata)


def _sync_history_item(history, provider):
    return {
        "id": history.id,
        "provider_id": history.provider_id,
        "provider_key": provider.provider_key if provider else None,
        "trigger_type": history.trigger_type,
        "status": history.status,
        "started_at": history.started_at,
        "completed_at": history.completed_at,
        "discovered_count": history.discovered_count,
        "inserted_count": history.inserted_count,
        "updated_count": history.updated_count,
        "unchanged_count": history.unchanged_count,
        "deactivated_count": history.deactivated_count,
        "error_details": history.error_details,
        "created_at": history.created_at,
    }


def _history_page(result, items):
    return {
        "items": items,
        "total": result["total"],
        "page": result["page"],
        "page_size": result["page_size"],
        "total_pages": result["total_pages"],
    }


async def _catalog_response(db, **filters):
    result = await tool_catalog_service.list_tools(db, **filters)
    return {
        "items": [_summary(tool, provider) for tool, provider in result["items"]],
        "total": result["total"],
        "page": result["page"],
        "page_size": result["page_size"],
        "total_pages": result["total_pages"],
    }

@router.get("/providers", response_model=list[ProviderResponse])
@handle_tool_errors
async def list_providers(enabled: bool | None = Query(default=True),db: AsyncSession = Depends(get_db)):
    return await tool_catalog_service.list_providers(db, enabled=enabled)


@router.get("/health", response_model=HealthResponse)
@handle_tool_errors
async def tools_health(request: Request,probe: bool = Query(default=False, description="Make one lightweight call to each provider to test availability"),registry=Depends(get_registry),db: AsyncSession = Depends(get_db)):
    rows = {row.provider_key: row for row in await tool_catalog_service.list_providers(db, enabled=None)}
    providers = []
    for key, provider in sorted(registry.get_all().items()):
        info = provider.health()
        entry = {
            "provider_key": key,
            "status": info.get("status", "registered"),
            "configured": info.get("configured"),
            "available": None,
            "detail": None,
            "sync_interval_minutes": int((provider.manifest.get("configuration") or {}).get("sync_interval_minutes", 0) or 0),
            "last_synced_at": rows[key].last_synced_at if key in rows else None,
        }
        if probe:
            try:
                await asyncio.wait_for(provider.check_availability(), timeout=PROBE_TIMEOUT_SECONDS)
                entry["available"] = True
            except asyncio.TimeoutError:
                entry["available"], entry["detail"] = False, "Provider did not answer in time"
            except Exception as exc:
                entry["available"], entry["detail"] = False, handle_error_detail(exc)
                tool_log("WARNING", "FAILURE", "HEALTH_PROBE", "tool.provider.classified", key, type(exc).__name__)
        providers.append(entry)
    scheduler = getattr(request.app.state, "tool_sync_scheduler", None)
    degraded = any(p["configured"] is False or p["available"] is False for p in providers)
    return {
        "status": "degraded" if degraded or not providers else "healthy",
        "providers": providers,
        "scheduler": scheduler.status() if scheduler else {"enabled": False},
    }


def handle_error_detail(exc: Exception) -> str:
    from modules.tools.errors import tool_http_exception

    detail = tool_http_exception(exc).detail
    return detail.get("message", "Provider check failed") if isinstance(detail, dict) else str(detail)


@router.get("/toolkits", response_model=list[ToolkitSummaryResponse])
@handle_tool_errors
async def list_toolkits(
    provider_key: str | None = None,
    search: str | None = Query(default=None, max_length=100),
    enabled: bool | None = True,
    registry=Depends(get_registry),
    db: AsyncSession = Depends(get_db),
):
    """Every app the provider offers, including ones whose tools are not loaded yet (`synced: false`)."""
    return await ToolkitDirectoryService(registry, tool_catalog_service).list(db, provider_key=provider_key, search=search, enabled=enabled)


@router.post("/toolkits/{toolkit_key}/refresh", response_model=ToolkitRefreshResponse)
@handle_tool_errors
async def refresh_toolkit(toolkit_key: str,payload: ToolkitRefreshRequest = ToolkitRefreshRequest(),provider_key: str | None = None,service: ToolkitRefreshService = Depends(get_refresh_service)):
    """Load one app's tools on demand. Safe for any signed-in user to call: it only contacts the provider when the
    stored tools are missing or older than a day (or 15 minutes for `force`), so repeat calls cost nothing."""
    return await service.refresh(toolkit_key, provider_key=provider_key, force=payload.force)


@router.get("/categories", response_model=list[CategorySummaryResponse])
@handle_tool_errors
async def list_categories(provider_key: str | None = None,enabled: bool | None = True,db: AsyncSession = Depends(get_db)):
    return await tool_catalog_service.list_categories(db, provider_key=provider_key, enabled=enabled)


def _catalog_filters(
    toolkit_key: str | None = None,
    category: str | None = None,
    status: str | None = None,
    enabled: bool | None = True,
    search: str | None = Query(default=None, max_length=100),
    sort: str = Query(default="name", pattern="^(name|toolkit|category|updated)$"),
    order: str = Query(default="asc", pattern="^(asc|desc)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> dict[str, Any]:
    return {
        "toolkit_key": toolkit_key, "category": category, "status": status, "enabled": enabled,
        "search": search, "sort": sort, "order": order, "page": page, "page_size": page_size,
    }


@router.get("/providers/{provider_key}/catalog", response_model=ToolListResponse)
@handle_tool_errors
async def list_provider_catalog(provider_key: str,filters: dict[str, Any] = Depends(_catalog_filters),db: AsyncSession = Depends(get_db)):
    if await tool_catalog_service.get_provider(db, provider_key) is None:
        raise HTTPException(status_code=404, detail={"code": "provider_not_found", "message": "Tool provider not found"})
    return await _catalog_response(db, provider_key=provider_key, **filters)


@router.get("/catalog", response_model=ToolListResponse)
@handle_tool_errors
async def list_catalog(provider_key: str | None = None,filters: dict[str, Any] = Depends(_catalog_filters),db: AsyncSession = Depends(get_db)):
    return await _catalog_response(db, provider_key=provider_key, **filters)

@router.post("/sync", response_model=GlobalSynchronizationResponse)
@handle_tool_errors
async def synchronize_all(request: Request,payload: SynchronizationRequest = SynchronizationRequest(),service: ToolSynchronizationService = Depends(get_sync_service)):
    return await service.sync_all(trigger_type="manual", allow_empty_catalog=payload.allow_empty_catalog)


@router.post("/providers/{provider_key}/sync")
@handle_tool_errors
async def synchronize_provider(provider_key: str,request: Request,payload: SynchronizationRequest = SynchronizationRequest(),service: ToolSynchronizationService = Depends(get_sync_service)):
    return await service.sync_provider(provider_key=provider_key, trigger_type="manual", allow_empty_catalog=payload.allow_empty_catalog)


@router.get("/sync/history", response_model=HistoryListResponse)
@handle_tool_errors
async def get_sync_history(provider_key: str | None = None,page: int = Query(default=1, ge=1),page_size: int = Query(default=20, ge=1, le=100),db: AsyncSession = Depends(get_db)):
    result = await tool_history_service.sync_history(db, provider_key=provider_key, page=page, page_size=page_size)
    return _history_page(result, [_sync_history_item(history, provider) for history, provider in result["items"]])

@router.get("/history", response_model=UserHistoryResponse)
@handle_tool_errors
async def get_my_history(
    tool_id: UUID | None = None,
    status: str | None = Query(default=None, pattern="^(success|failed)$"),
    mode: str | None = Query(default=None, pattern="^(execute|dry_run|live_test)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Recent runs (executions, dry runs, live tests) made by the caller, across all tools."""
    return await tool_history_service.user_history(db, UUID(user_id), tool_id=tool_id, status=status, mode=mode, page=page, page_size=page_size)


@router.post("/execute", response_model=ToolExecutionResponse)
@handle_tool_errors
async def execute_tool(payload: ToolExecutionRequest,request: Request,user_id: str = Depends(get_current_user_id),service: ToolExecutionService = Depends(get_execution_service),db: AsyncSession = Depends(get_db)):
    result = await service.execute(
        db=db,
        tool_id=payload.tool_id,
        arguments=payload.arguments,
        user_id=user_id,
        connected_account_id=payload.connected_account_id,
        credential_id=str(payload.credential_id) if payload.credential_id else None,
        request_id=request.headers.get("X-Request-ID"),
    )
    return _execution_response(result)

@router.get("/{tool_id}", response_model=ToolDetailResponse)
@handle_tool_errors
async def get_tool(tool_id: UUID, db: AsyncSession = Depends(get_db)):
    record = await tool_catalog_service.get_tool(db, tool_id)
    if record is None:
        raise HTTPException(status_code=404, detail={"code": "tool_not_found", "message": "Tool not found"})
    tool, provider = record
    return {
        **ToolResponse.model_validate(tool).model_dump(),
        "provider_key": provider.provider_key,
        "requires_connection": _schema_summary(tool)["requires_connection"],
        "required_parameters": _schema_summary(tool)["required_parameters"],
    }


@router.post("/{tool_id}/test", response_model=ToolTestResponse)
@handle_tool_errors
async def test_tool(tool_id: UUID,payload: ToolTestRequest,request: Request,user_id: str = Depends(get_current_user_id),service: ToolExecutionService = Depends(get_execution_service),db: AsyncSession = Depends(get_db)):
    """Dry run by default: validates the tool, arguments and connected account with no external side effects.
    Set ``live: true`` to also run the tool for real."""
    if payload.live:
        report = await service.live_test(db, tool_id, payload.arguments, user_id,connected_account_id=payload.connected_account_id,request_id=request.headers.get("X-Request-ID"),credential_id=str(payload.credential_id) if payload.credential_id else None)
    else:
        report = await service.dry_run(db, tool_id, payload.arguments, user_id, connected_account_id=payload.connected_account_id)
    execution = report.pop("execution")
    return {**report, "execution": _execution_response(execution) if execution is not None else None}


@router.get("/{tool_id}/test/history", response_model=HistoryListResponse)
@handle_tool_errors
async def get_tool_test_history(
    tool_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Only the caller's own runs are returned."""
    result = await tool_history_service.test_history(db, tool_id=tool_id, user_id=UUID(user_id), page=page, page_size=page_size)
    items = [TestHistoryResponse.model_validate(item, from_attributes=True).model_dump(mode="json") for item in result["items"]]
    return _history_page(result, items)
