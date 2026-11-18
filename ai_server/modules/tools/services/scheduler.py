import asyncio
import os
from datetime import UTC, datetime, timedelta
from typing import Any, Awaitable, Callable

from sqlalchemy import select

from modules.tools.core.registry import ToolProviderRegistry
from modules.tools.logs import tool_log
from modules.tools.models import ToolProvider
from modules.tools.services.synchronization import ToolSynchronizationService

def scheduler_enabled() -> bool:
    return os.getenv("TOOLS_SCHEDULED_SYNC_ENABLED", "false").strip().lower() in ("1", "true", "yes", "on")


async def read_last_synced(provider_key: str) -> datetime | None:
    from configurations.databases.database import AsyncSessionLocal
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(ToolProvider.last_synced_at).where(ToolProvider.provider_key == provider_key))
        return result.scalar_one_or_none()


class ToolSyncScheduler:
    """Runs catalog synchronization for each provider at the interval in its manifest.

    ``configuration.sync_interval_minutes`` is per provider; 0 (or missing) disables it. A run is skipped while the
    previous one for that provider is still going, and a failed run is retried after ``retry_after_failure_seconds``
    (never sooner than the tick) instead of hammering the provider. Concurrent runs across processes are serialized
    by the synchronizer's database advisory lock.
    """

    def __init__(
        self,
        registry: ToolProviderRegistry,
        sync_service: ToolSynchronizationService,
        *,
        tick_seconds: float | None = None,
        startup_delay_seconds: float | None = None,
        retry_after_failure_seconds: float = 900,
        last_synced_reader: Callable[[str], Awaitable[datetime | None]] = read_last_synced,
    ):
        self.registry = registry
        self.sync_service = sync_service
        self.tick_seconds = tick_seconds if tick_seconds is not None else float(os.getenv("TOOLS_SYNC_TICK_SECONDS", "60"))
        self.startup_delay_seconds = (startup_delay_seconds if startup_delay_seconds is not None else float(os.getenv("TOOLS_SYNC_STARTUP_DELAY_SECONDS", "30")))
        self.retry_after_failure_seconds = retry_after_failure_seconds
        self._read_last_synced = last_synced_reader
        self._task: asyncio.Task | None = None
        self._stopping = asyncio.Event()
        self._locks: dict[str, asyncio.Lock] = {}
        self._state: dict[str, dict[str, Any]] = {}

    def start(self) -> None:
        if self._task is not None and not self._task.done():
            return
        self._stopping.clear()
        self._task = asyncio.create_task(self._run(), name="tool-catalog-scheduler")
        tool_log("INFO", "STARTED", "SCHEDULER", "tool.scheduler.started", self.tick_seconds)

    async def stop(self, timeout: float = 10) -> None:
        self._stopping.set()
        task, self._task = self._task, None
        if task is None:
            return
        tool_log("INFO", "COMPLETED", "SCHEDULER", "tool.scheduler.stopped")
        task.cancel()
        try:
            await asyncio.wait_for(task, timeout=timeout)
        except (asyncio.CancelledError, asyncio.TimeoutError):
            pass

    def status(self) -> dict[str, Any]:
        return {
            "enabled": self._task is not None and not self._task.done(),
            "tick_seconds": self.tick_seconds,
            "providers": {
                key: {**{k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in state.items()}}
                for key, state in sorted(self._state.items())
            },
        }

    @staticmethod
    def interval_minutes(provider) -> int:
        try:
            return max(0, int((provider.manifest.get("configuration") or {}).get("sync_interval_minutes", 0) or 0))
        except (TypeError, ValueError):
            return 0

    async def _next_due(self, key: str, interval: timedelta) -> datetime:
        state = self._state.setdefault(key, {})
        if state.get("next_run_at"):
            return state["next_run_at"]
        last = await self._read_last_synced(key)
        due = (last + interval) if last else datetime.now(UTC)
        state["next_run_at"] = due
        return due

    async def run_due(self) -> list[str]:
        """One scheduling pass. Returns the provider keys that were synchronized."""
        ran: list[str] = []
        for key in self.registry.keys():
            minutes = self.interval_minutes(self.registry.get(key))
            if minutes <= 0:
                continue
            interval = timedelta(minutes=minutes)
            try:
                due = await self._next_due(key, interval)
            except Exception:
                tool_log("ERROR", "FAILURE", "SCHEDULER", "tool.scheduler.read.failed", key, exc_info=True)
                continue
            if datetime.now(UTC) < due:
                continue
            if await self._sync(key, interval):
                ran.append(key)
        return ran

    async def _sync(self, key: str, interval: timedelta) -> bool:
        lock = self._locks.setdefault(key, asyncio.Lock())
        if lock.locked():
            tool_log("WARNING", "REJECTED", "SCHEDULER", "tool.scheduler.run.skipped", key)
            return False  
        state = self._state.setdefault(key, {})
        async with lock:
            state["last_started_at"] = datetime.now(UTC)
            tool_log("INFO", "STARTED", "SCHEDULER", "tool.scheduler.run.started", key)
            try:
                result = await self.sync_service.sync_provider(provider_key=key, trigger_type="scheduled")
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                tool_log("ERROR", "FAILURE", "SCHEDULER", "tool.scheduler.run.failed", key, f"{type(exc).__name__}: {str(exc)[:300]}")
                state.update(
                    last_status="failed",
                    last_error=str(exc)[:300],
                    next_run_at=datetime.now(UTC)
                    + timedelta(seconds=min(self.retry_after_failure_seconds, interval.total_seconds())),
                )
                return True
            tool_log("INFO", "COMPLETED", "SCHEDULER", "tool.scheduler.run.completed", key, result.get("status", "success"))
            state.update(
                last_status=result.get("status", "success"),
                last_error=None,
                last_finished_at=datetime.now(UTC),
                next_run_at=datetime.now(UTC) + interval,
            )
            return True

    async def _run(self) -> None:
        try:
            await asyncio.wait_for(self._stopping.wait(), timeout=self.startup_delay_seconds)
            return
        except asyncio.TimeoutError:
            pass
        while not self._stopping.is_set():
            try:
                await self.run_due()
            except asyncio.CancelledError:
                raise
            except Exception:
                tool_log("ERROR", "FAILURE", "SCHEDULER", "tool.scheduler.pass.failed", exc_info=True)
            try:
                await asyncio.wait_for(self._stopping.wait(), timeout=self.tick_seconds)
            except asyncio.TimeoutError:
                continue
