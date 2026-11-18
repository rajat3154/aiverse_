from datetime import datetime
from typing import Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

class ProviderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    provider_key: str
    slug: str
    name: str
    description: str | None = None
    provider_type: str
    status: str
    manifest_version: str
    capabilities: dict[str, Any] = Field(default_factory=dict)
    enabled: bool
    last_synced_at: datetime | None = None

class ToolResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    provider_id: UUID
    external_tool_id: str
    slug: str
    name: str
    description: str | None = None
    category: str | None = None
    toolkit_key: str | None = None
    connector_key: str | None = None
    execution_type: str
    input_schema: dict[str, Any]
    output_schema: dict[str, Any]
    auth_requirements: dict[str, Any]
    tool_metadata: dict[str, Any]
    version: str | None = None
    status: str
    enabled: bool
    last_seen_at: datetime

class ToolSummaryResponse(BaseModel):
    """List view: display fields only. Full schemas are on GET /api/tools/{tool_id}."""
    id: UUID
    provider_key: str
    external_tool_id: str
    slug: str
    name: str
    description: str | None = None
    category: str | None = None
    toolkit_key: str | None = None
    execution_type: str
    requires_connection: bool
    required_parameters: list[str] = Field(default_factory=list)
    parameter_count: int = 0
    version: str | None = None
    status: str
    enabled: bool
    last_seen_at: datetime

class ToolDetailResponse(ToolResponse):
    provider_key: str
    requires_connection: bool
    required_parameters: list[str] = Field(default_factory=list)

class ToolListResponse(BaseModel):
    items: list[ToolSummaryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

class ToolExecutionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tool_id: UUID
    arguments: dict[str, Any] = Field(default_factory=dict)
    connected_account_id: str | None = None

class ToolTestRequest(BaseModel):
    """Body of POST /api/tools/{tool_id}/test. The tool comes from the URL (a stray tool_id is ignored).
    Dry run unless live=true."""
    model_config = ConfigDict(extra="ignore")
    arguments: dict[str, Any] = Field(default_factory=dict)
    connected_account_id: str | None = None
    live: bool = False

class ToolExecutionResponse(BaseModel):
    success: bool
    data: Any = None
    error: dict[str, Any] | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)

class TestCheck(BaseModel):
    name: str
    status: str  # passed | failed | skipped
    message: str
    details: dict[str, Any] = Field(default_factory=dict)

class ToolTestResponse(BaseModel):
    mode: str  # dry_run | live
    passed: bool
    executed: bool
    tool: dict[str, Any]
    checks: list[TestCheck]
    connected_account_id: str | None = None
    execution: ToolExecutionResponse | None = None

class ToolkitSummaryResponse(BaseModel):
    provider_key: str
    toolkit_key: str
    name: str
    tool_count: int
    category: str | None = None
    description: str | None = None
    logo: str | None = None
    app_url: str | None = None
    auth_schemes: list[str] = Field(default_factory=list)
    no_auth: bool = False
    synced: bool = True            
    synced_at: datetime | None = None

class ToolkitRefreshRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    force: bool = False       

class ToolkitRefreshResponse(BaseModel):
    status: str                
    provider_key: str
    toolkit_key: str
    synced_at: datetime | None = None
    next_refresh_at: datetime | None = None
    counts: dict[str, int] | None = None

class UserHistoryItem(BaseModel):
    id: UUID
    tool_id: UUID
    tool_name: str
    tool_slug: str
    toolkit_key: str | None = None
    test_mode: str 
    status: str
    error_code: str | None = None
    error_message: str | None = None
    latency_ms: int | None = None
    started_at: datetime

class UserHistoryResponse(BaseModel):
    items: list[UserHistoryItem]
    total: int
    page: int
    page_size: int
    total_pages: int

class CategorySummaryResponse(BaseModel):
    category: str
    tool_count: int

class ProviderHealthResponse(BaseModel):
    provider_key: str
    status: str
    configured: bool | None = None
    available: bool | None = None
    detail: str | None = None
    sync_interval_minutes: int = 0
    last_synced_at: datetime | None = None

class HealthResponse(BaseModel):
    status: str
    providers: list[ProviderHealthResponse]
    scheduler: dict[str, Any]

class SynchronizationRequest(BaseModel):
    allow_empty_catalog: bool = False

class SynchronizationResultResponse(BaseModel):
    provider_key: str
    discovered: int
    inserted: int
    updated: int
    unchanged: int
    deactivated: int
    status: str

class GlobalSynchronizationResponse(BaseModel):
    status: str
    provider_count: int
    successful_count: int
    failed_count: int
    discovered: int
    inserted: int
    updated: int
    unchanged: int
    deactivated: int
    results: list[dict[str, Any]]
    failures: list[dict[str, Any]]

class SyncHistoryResponse(BaseModel):
    id: UUID
    provider_id: UUID | None = None
    trigger_type: str
    status: str
    started_at: datetime
    completed_at: datetime | None = None
    discovered_count: int
    inserted_count: int
    updated_count: int
    unchanged_count: int
    deactivated_count: int
    error_details: dict[str, Any] | None = None
    created_at: datetime

class TestHistoryResponse(BaseModel):
    id: UUID
    tool_id: UUID
    user_id: UUID | None = None
    test_mode: str
    status: str
    input_snapshot: dict[str, Any] | None = None
    output_snapshot: dict[str, Any] | None = None
    error_code: str | None = None
    error_message: str | None = None
    latency_ms: int | None = None
    started_at: datetime
    completed_at: datetime | None = None
    created_at: datetime

class HistoryListResponse(BaseModel):
    items: list[dict[str, Any]]
    total: int
    page: int
    page_size: int
    total_pages: int

