from uuid import UUID
from typing import Any
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from modules.tools.models import ToolCatalog, ToolProvider

def _like_escape(term: str) -> str:
    """Make %, _ and backslash match literally inside a LIKE pattern (used with escape="\\")."""
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class ToolCatalogService:
    async def list_providers(self, db: AsyncSession, enabled: bool | None = True) -> list[ToolProvider]:
        query = select(ToolProvider)
        if enabled is not None:
            query = query.where(ToolProvider.enabled == enabled)
        query = query.order_by(ToolProvider.name.asc())
        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_provider(self, db: AsyncSession, provider_key: str) -> ToolProvider | None:
        query = select(ToolProvider).where(ToolProvider.provider_key == provider_key)
        result = await db.execute(query)
        return result.scalar_one_or_none()

    async def list_tools(self,db: AsyncSession,*,provider_key: str | None = None,toolkit_key: str | None = None,category: str | None = None,status: str | None = None,enabled: bool | None = True,search: str | None = None,page: int = 1,page_size: int = 50,sort: str = "name",order: str = "asc") -> dict[str, Any]:
        page = max(1, page)
        page_size = min(200, max(1, page_size))
        filters = []
        if provider_key:
            filters.append(ToolProvider.provider_key == provider_key)
        if toolkit_key:
            filters.append(ToolCatalog.toolkit_key == toolkit_key)
        if category:
            filters.append(ToolCatalog.category == category)
        if status:
            filters.append(ToolCatalog.status == status)
        if enabled is not None:
            filters.append(ToolCatalog.enabled == enabled)
        if search and search.strip():
            escaped = _like_escape(search.strip())
            term = f"%{escaped}%"
            filters.append(or_(
                    ToolCatalog.name.ilike(term, escape="\\"),
                    ToolCatalog.slug.ilike(term, escape="\\"),
                    ToolCatalog.external_tool_id.ilike(term, escape="\\"),
                    ToolCatalog.description.ilike(term, escape="\\"),
                    ToolCatalog.toolkit_key.ilike(term, escape="\\"),
                ))
        base_query = select(ToolCatalog, ToolProvider).join(ToolProvider,ToolCatalog.provider_id == ToolProvider.id).where(*filters)
        count_query = select(func.count(ToolCatalog.id)).join(ToolProvider,ToolCatalog.provider_id == ToolProvider.id).where(*filters)
        total_result = await db.execute(count_query)
        total = total_result.scalar_one()
        result = await db.execute(base_query.order_by(*self._ordering(sort, order)).offset((page - 1) * page_size).limit(page_size))
        return {
            "items": result.all(),
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }

    @staticmethod
    def _ordering(sort: str, order: str):
        direction = (lambda column: column.desc()) if order == "desc" else (lambda column: column.asc())
        primary = {
            "name": ToolCatalog.name,
            "toolkit": ToolCatalog.toolkit_key,
            "category": ToolCatalog.category,
            "updated": ToolCatalog.last_seen_at,
        }.get(sort, ToolCatalog.name)
        return [direction(primary), ToolCatalog.name.asc(), ToolCatalog.id.asc()]

    async def list_toolkits(self,db: AsyncSession,*,provider_key: str | None = None,search: str | None = None,enabled: bool | None = True) -> list[dict[str, Any]]:
        """One entry per toolkit with its tool count and display data (taken from a representative tool row)."""
        filters = [ToolCatalog.toolkit_key.is_not(None)]
        if provider_key:
            filters.append(ToolProvider.provider_key == provider_key)
        if enabled is not None:
            filters.append(ToolCatalog.enabled == enabled)
        if search and search.strip():
            term = f"%{_like_escape(search.strip())}%"
            filters.append(or_(ToolCatalog.toolkit_key.ilike(term, escape="\\"),ToolCatalog.tool_metadata["toolkit_name"].as_string().ilike(term, escape="\\")))
        partition = (ToolProvider.provider_key, ToolCatalog.toolkit_key)
        result = await db.execute(
            select(ToolProvider.provider_key,ToolCatalog.toolkit_key,ToolCatalog.category,ToolCatalog.tool_metadata,func.count(ToolCatalog.id).over(partition_by=partition).label("tool_count"),func.max(ToolCatalog.last_seen_at).over(partition_by=partition).label("synced_at"))
            .join(ToolProvider, ToolCatalog.provider_id == ToolProvider.id)
            .where(*filters)
            .distinct(*partition)
            .order_by(*partition, ToolCatalog.name.asc()))
        toolkits = []
        for provider, toolkit, category, metadata, count, synced_at in result.all():
            metadata = metadata or {}
            toolkits.append(
                {
                    "provider_key": provider,
                    "toolkit_key": toolkit,
                    "name": metadata.get("toolkit_name") or toolkit,
                    "tool_count": count,
                    "category": category,
                    "description": metadata.get("toolkit_description"),
                    "logo": metadata.get("toolkit_logo"),
                    "app_url": metadata.get("toolkit_app_url"),
                    "auth_schemes": list(metadata.get("toolkit_auth_schemes") or []),
                    "no_auth": bool(metadata.get("toolkit_no_auth", False)),
                    "synced": True,
                    "synced_at": synced_at,
                }
            )
        return sorted(toolkits, key=lambda item: item["name"].casefold())

    async def list_categories(self, db: AsyncSession, *, provider_key: str | None = None, enabled: bool | None = True) -> list[dict[str, Any]]:
        filters = [ToolCatalog.category.is_not(None)]
        if provider_key:
            filters.append(ToolProvider.provider_key == provider_key)
        if enabled is not None:
            filters.append(ToolCatalog.enabled == enabled)
        result = await db.execute(select(ToolCatalog.category, func.count(ToolCatalog.id)).join(ToolProvider, ToolCatalog.provider_id == ToolProvider.id).where(*filters).group_by(ToolCatalog.category).order_by(ToolCatalog.category.asc()))
        return [{"category": category, "tool_count": count} for category, count in result.all()]

    async def get_tool(self, db: AsyncSession, tool_id: UUID) -> tuple[ToolCatalog, ToolProvider] | None:
        query = (select(ToolCatalog, ToolProvider).join(ToolProvider, ToolCatalog.provider_id == ToolProvider.id).where(ToolCatalog.id == tool_id))
        result = await db.execute(query)
        return result.one_or_none()

tool_catalog_service = ToolCatalogService()
