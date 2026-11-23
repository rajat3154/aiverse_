from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ConnectionBody(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=150)
    slug: str = Field(min_length=1, max_length=100)
    configuration: dict[str, Any] = Field(default_factory=dict)


class ConnectionTestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    slug: str = Field(min_length=1, max_length=100)
    configuration: dict[str, Any] = Field(default_factory=dict)
    connection_id: UUID | None = None


class ConnectionTestResponse(BaseModel):
    success: bool
    message: str
    error_code: str = ""
    latency_ms: int = 0


class ConnectionResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    configuration: dict[str, Any]
    saved_secret_fields: list[str]
    created_at: datetime
    updated_at: datetime
