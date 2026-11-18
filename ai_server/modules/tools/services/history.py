from typing import Any
from uuid import UUID
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from modules.tools.models import ToolCatalog, ToolSyncHistory, ToolTestHistory, ToolProvider

class ToolHistoryService:
    @staticmethod
    async def sync_history(db: AsyncSession,provider_key: str | None = None,page: int = 1,page_size: int = 20) -> dict[str, Any]:
        page = max(1, page)
        page_size = min(100, max(1, page_size))
        query = select(ToolSyncHistory, ToolProvider).outerjoin(ToolProvider,ToolSyncHistory.provider_id == ToolProvider.id)
        count_query = select(func.count(ToolSyncHistory.id)).outerjoin(ToolProvider,ToolSyncHistory.provider_id == ToolProvider.id)
        if provider_key:
            query = query.where(ToolProvider.provider_key == provider_key)
            count_query = count_query.where(ToolProvider.provider_key == provider_key)
        total = (await db.execute(count_query)).scalar_one()
        result = await db.execute(query.order_by(ToolSyncHistory.started_at.desc()).offset((page - 1) * page_size).limit(page_size))
        return {
            "items": result.all(),
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }

    @staticmethod
    async def user_history(db: AsyncSession,user_id: UUID,tool_id: UUID | None = None,status: str | None = None,mode: str | None = None,page: int = 1,page_size: int = 20) -> dict[str, Any]:
        """The caller's own recent runs across every tool, newest first."""
        page = max(1, page)
        page_size = min(100, max(1, page_size))
        filters = [ToolTestHistory.user_id == user_id]
        if tool_id is not None:
            filters.append(ToolTestHistory.tool_id == tool_id)
        if status:
            filters.append(ToolTestHistory.status == status)
        if mode:
            filters.append(ToolTestHistory.test_mode == mode)
        total = (await db.execute(select(func.count(ToolTestHistory.id)).where(*filters))).scalar_one()
        rows = await db.execute(
            select(ToolTestHistory, ToolCatalog.name, ToolCatalog.slug, ToolCatalog.toolkit_key)
            .join(ToolCatalog, ToolTestHistory.tool_id == ToolCatalog.id)
            .where(*filters)
            .order_by(ToolTestHistory.started_at.desc(), ToolTestHistory.id.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        return {
            "items": [
                {
                    "id": run.id, "tool_id": run.tool_id, "tool_name": name, "tool_slug": slug, "toolkit_key": toolkit,
                    "test_mode": run.test_mode, "status": run.status, "error_code": run.error_code,
                    "error_message": run.error_message, "latency_ms": run.latency_ms, "started_at": run.started_at,
                }
                for run, name, slug, toolkit in rows.all()
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }

    @staticmethod
    async def test_history(
        db: AsyncSession,
        tool_id: UUID,
        user_id: UUID | None = None,
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        """Test/execution history for one tool. Pass ``user_id`` so callers only ever see their own runs."""
        page = max(1, page)
        page_size = min(100, max(1, page_size))
        query = select(ToolTestHistory).where(ToolTestHistory.tool_id == tool_id)
        count_query = select(func.count(ToolTestHistory.id)).where(ToolTestHistory.tool_id == tool_id)
        if user_id is not None:
            query = query.where(ToolTestHistory.user_id == user_id)
            count_query = count_query.where(ToolTestHistory.user_id == user_id)
        total = (await db.execute(count_query)).scalar_one()
        result = await db.execute(query.order_by(ToolTestHistory.started_at.desc()).offset((page - 1) * page_size).limit(page_size))
        return {
            "items": list(result.scalars().all()),
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
        }

tool_history_service = ToolHistoryService()
