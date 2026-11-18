
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger,Boolean,DateTime,ForeignKey,Index,Integer,String,Text,UniqueConstraint,func,text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from configurations.databases.base import Base


class ToolProvider(Base):
    __tablename__ = "tool_providers"
    __table_args__ = (Index("idx_tool_providers_enabled", "enabled"),Index("idx_tool_providers_type", "provider_type"))

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True),primary_key=True,server_default=text("gen_random_uuid()
    provider_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    provider_type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    manifest_version: Mapped[str] = mapped_column(String(30), nullable=False)
    manifest_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    manifest: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    capabilities: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
    sync_interval_minutes: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("360"))
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("true"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class ToolCatalog(Base):
    __tablename__ = "tool_catalog"
    __table_args__ = (UniqueConstraint("provider_id","external_tool_id",name="uk_tool_catalog_provider_external_id"),
        Index("idx_tool_catalog_provider", "provider_id"),
        Index("idx_tool_catalog_category", "category"),
        Index("idx_tool_catalog_toolkit", "toolkit_key"),
        Index("idx_tool_catalog_enabled", "enabled"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    provider_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tool_providers.id", ondelete="RESTRICT"),
        nullable=False,
    )
    external_tool_id: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(100))
    toolkit_key: Mapped[str | None] = mapped_column(String(150))
    connector_key: Mapped[str | None] = mapped_column(String(150))
    execution_type: Mapped[str] = mapped_column(String(50), nullable=False)
    input_schema: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    output_schema: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    auth_requirements: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, server_default=text("'{}'::jsonb")
    )
    tool_metadata: Mapped[dict[str, Any]] = mapped_column(
        "metadata",
        JSONB,
        nullable=False,
        server_default=text("'{}'::jsonb"),
    )
    definition_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    version: Mapped[str | None] = mapped_column(String(50))
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    enabled: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ToolSyncHistory(Base):
    __tablename__ = "tool_sync_history"
    __table_args__ = (
        Index("idx_tool_sync_history_provider", "provider_id"),
        Index("idx_tool_sync_history_started", "started_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    provider_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tool_providers.id", ondelete="SET NULL"),
    )
    trigger_type: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    discovered_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    inserted_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    updated_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    unchanged_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    deactivated_count: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    error_details: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ToolTestHistory(Base):
    __tablename__ = "tool_test_history"
    __table_args__ = (
        Index("idx_tool_test_history_tool", "tool_id"),
        Index("idx_tool_test_history_created", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    tool_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tool_catalog.id", ondelete="RESTRICT"),
        nullable=False,
    )
    # The foreign key to users.tenant_id lives in the Spring-owned Liquibase schema (fk_tool_test_history_user). It is
    # deliberately not declared here: `users` is not part of this service's metadata, and declaring it makes every
    # flush of this model fail with NoReferencedTableError.
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    test_mode: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
    input_snapshot: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    output_snapshot: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    error_code: Mapped[str | None] = mapped_column(String(100))
    error_message: Mapped[str | None] = mapped_column(Text)
    latency_ms: Mapped[int | None] = mapped_column(BigInteger)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
