import time
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from jsonschema import Draft202012Validator
from jsonschema.exceptions import SchemaError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.tools.core.contracts import ToolExecutionContext, ToolExecutionResult
from modules.tools.core.exceptions import (
    AmbiguousConnectionError,
    ConnectionInactiveError,
    ConnectionMismatchError,
    ToolAccessDeniedError,
    ToolConnectionRequiredError,
    ToolError,
    ToolNotFoundError,
    ToolProviderNotFoundError,
    ToolProviderUnavailableError,
    ToolValidationError,
)
from modules.tools.logs import tool_log
from modules.tools.models import ToolCatalog, ToolProvider, ToolTestHistory
from modules.tools.security import short_message, snapshot
from modules.tools.services.accounts import ResolvedAccount, ToolAccountResolver

MODE_EXECUTE = "execute"
MODE_LIVE_TEST = "live_test"
MODE_DRY_RUN = "dry_run"


class ToolExecutionService:
    def __init__(self, registry, accounts: ToolAccountResolver):
        self.registry = registry
        self.accounts = accounts

    @staticmethod
    def _user_uuid(user_id: str | None) -> UUID:
        if not user_id or not str(user_id).strip():
            raise ToolValidationError("Authenticated user ID is required")
        try:
            return UUID(str(user_id))
        except (ValueError, TypeError, AttributeError) as exc:
            raise ToolValidationError("Authenticated user ID must be a valid UUID") from exc

    @staticmethod
    async def _load_tool(db: AsyncSession, tool_id: UUID):
        result = await db.execute(select(ToolCatalog, ToolProvider).join(ToolProvider, ToolCatalog.provider_id == ToolProvider.id).where(ToolCatalog.id == tool_id))
        record = result.one_or_none()
        if record is None:
            raise ToolNotFoundError(f"Tool '{tool_id}' was not found")
        return record

    @staticmethod
    def _availability_problem(tool: ToolCatalog, provider: ToolProvider) -> str | None:
        if not tool.enabled or tool.status != "active":
            return "This tool is inactive or disabled"
        if not provider.enabled:
            return "This tool provider is disabled"
        return None

    def _provider(self, provider_record: ToolProvider):
        try:
            return self.registry.get(provider_record.provider_key)
        except ToolProviderNotFoundError as exc:
            raise ToolProviderUnavailableError(f"Provider '{provider_record.provider_key}' is not loaded") from exc

    @staticmethod
    def schema_errors(schema: dict[str, Any] | None, arguments: Any) -> list[str]:
        if not isinstance(arguments, dict):
            return ["Tool arguments must be a JSON object"]
        if not schema:
            return []
        try:
            validator = Draft202012Validator(schema)
            errors = sorted(validator.iter_errors(arguments), key=lambda error: list(map(str, error.path)))
        except SchemaError:
            tool_log("WARNING", "FAILURE", "VALIDATE", "tool.schema.invalid", "unknown")
            return []
        return [
            f"{'.'.join(map(str, error.path)) or 'arguments'}: {error.message}" for error in errors
        ]

    @staticmethod
    async def _record_history(
        db: AsyncSession,
        *,
        tool_id: UUID,
        user_uuid: UUID,
        mode: str,
        status: str,
        arguments: dict[str, Any],
        output: Any,
        error: dict[str, Any] | None,
        started_at: datetime,
        latency_ms: int,
    ) -> None:
        """Persist one history row. A failure here must never lose or fail the outcome the caller already earned."""
        try:
            async with db.begin_nested():
                db.add(
                    ToolTestHistory(
                        tool_id=tool_id,
                        user_id=user_uuid,
                        test_mode=mode,
                        status=status,
                        input_snapshot=snapshot(arguments),
                        output_snapshot=snapshot(output) if output is not None else None,
                        error_code=(error or {}).get("type") or (error or {}).get("code"),
                        error_message=(short_message((error or {}).get("message", "")) or None) if error else None,
                        latency_ms=latency_ms,
                        started_at=started_at,
                        completed_at=datetime.now(UTC),
                    )
                )
        except Exception:
            tool_log("ERROR", "FAILURE", "HISTORY", "tool.history.failed", str(tool_id), mode, exc_info=True)
            return
        try:
            await db.commit()
        except Exception:
            tool_log("ERROR", "FAILURE", "HISTORY", "tool.history.commit.failed", str(tool_id), mode, exc_info=True)
            try:
                await db.rollback()
            except Exception:
                tool_log("ERROR", "FAILURE", "HISTORY", "tool.history.commit.failed", str(tool_id), mode, exc_info=True)

    async def execute(
        self,
        db: AsyncSession,
        tool_id: UUID,
        arguments: dict[str, Any],
        user_id: str,
        connected_account_id: str | None = None,
        request_id: str | None = None,
        mode: str = MODE_EXECUTE,
    ) -> ToolExecutionResult:
        user_uuid = self._user_uuid(user_id)
        tool, provider_record = await self._load_tool(db, tool_id)
        tool_pk, external_tool_id, provider_key = tool.id, tool.external_tool_id, provider_record.provider_key
        slug, toolkit_key = tool.slug, tool.toolkit_key

        try:
            problem = self._availability_problem(tool, provider_record)
            if problem:
                raise ToolValidationError(problem)
            provider = self._provider(provider_record)
            errors = self.schema_errors(tool.input_schema, arguments)
            if errors:
                raise ToolValidationError("; ".join(errors[:10]))
            account = await self.accounts.resolve(tool, str(user_uuid), connected_account_id)
        except ToolError as exc:
            tool_log("WARNING", "REJECTED", "EXECUTE", "tool.execute.rejected", slug, type(exc).__name__)
            raise
        tool_log("INFO", "STARTED", "EXECUTE", "tool.execute.started",slug, toolkit_key or "-", mode, account.source if account else "none",context={"connected_account_id": account.id if account else None})
        context = ToolExecutionContext(
            user_id=str(user_uuid),
            request_id=request_id,
            metadata={"connected_account_id": account.id if account else None, "tool_id": str(tool_pk)},
        )
        started_at = datetime.now(UTC)
        clock = time.perf_counter()
        provider_failure: ToolError | None = None
        try:
            method = provider.test_tool if mode == MODE_LIVE_TEST else provider.execute_tool
            result = await method(external_tool_id=external_tool_id, arguments=arguments, context=context)
            if not isinstance(result, ToolExecutionResult):
                raise TypeError("Provider must return ToolExecutionResult")
        except ToolError as exc:
            provider_failure = exc
            result = ToolExecutionResult(success=False, error={"type": type(exc).__name__, "message": short_message(exc)})
        except Exception:
            tool_log("ERROR", "FAILURE", "EXECUTE", "tool.execute.unexpected", slug, exc_info=True)
            result = ToolExecutionResult(success=False, error={"type": "ProviderError", "message": "Tool execution failed unexpectedly"})
        latency_ms = int((time.perf_counter() - clock) * 1000)
        if provider_failure is not None or not result.success:
            tool_log("WARNING", "FAILURE", "EXECUTE", "tool.execute.failed",slug, mode, (result.error or {}).get("type", "unknown"), latency_ms)
        else:
            tool_log("INFO", "COMPLETED", "EXECUTE", "tool.execute.completed", slug, mode, True, latency_ms)

        await self._record_history(
            db,
            tool_id=tool_pk,
            user_uuid=user_uuid,
            mode=mode,
            status="success" if result.success else "failed",
            arguments=arguments,
            output={"data": result.data, "metadata": result.metadata} if result.success else None,
            error=result.error,
            started_at=started_at,
            latency_ms=latency_ms,
        )
        if provider_failure is not None:
            raise provider_failure
        result.metadata = {
            **result.metadata,
            "tool_id": str(tool_pk),
            "provider": provider_key,
            "latency_ms": latency_ms,
            "connected_account_id": account.id if account else None,
            "account_source": account.source if account else None,
            "request_id": request_id,
        }
        return result

    @staticmethod
    def _check(name: str, status: str, message: str, **details: Any) -> dict[str, Any]:
        return {"name": name, "status": status, "message": message, "details": details}

    async def preflight(
        self,
        db: AsyncSession,
        tool_id: UUID,
        arguments: dict[str, Any],
        user_id: str,
        connected_account_id: str | None = None,
    ) -> dict[str, Any]:
        """Everything a real run would verify, without calling the provider's execute. No external side effects.

        The only provider traffic is a read-only account lookup when the tool needs a connected account.
        """
        user_uuid = self._user_uuid(user_id)
        tool, provider_record = await self._load_tool(db, tool_id)
        checks: list[dict[str, Any]] = []

        problem = self._availability_problem(tool, provider_record)
        checks.append( self._check("tool_available", "failed", problem) if problem else self._check("tool_available", "passed", "Tool and provider are enabled"))
        try:
            provider = self._provider(provider_record)
            health = provider.health()
            configured = health.get("configured", True)
            checks.append( self._check("provider_ready", "passed", "Provider is loaded") if configured else self._check("provider_ready", "failed", "Provider is loaded but not configured"))
        except ToolProviderUnavailableError as exc:
            checks.append(self._check("provider_ready", "failed", str(exc)))
        problems = self.schema_errors(tool.input_schema, arguments)
        checks.append(
            self._check("arguments_valid", "failed", "Arguments do not match the tool's input schema", errors=problems)
            if problems
            else self._check("arguments_valid", "passed", "Arguments match the tool's input schema")
        )

        account: ResolvedAccount | None = None
        try:
            account = await self.accounts.resolve(tool, str(user_uuid), connected_account_id)
            if account:
                checks.append(self._check("connected_account", "passed", "Connected account is usable",id=account.id, alias=account.alias, toolkit=account.toolkit, source=account.source,))
            else:
                checks.append(self._check("connected_account", "skipped", "This tool needs no connected account"))
        except AmbiguousConnectionError as exc:
            checks.append(self._check("connected_account", "failed", str(exc), code="ambiguous_connection", candidates=exc.candidates))
        except ConnectionInactiveError as exc:
            checks.append(self._check("connected_account", "failed", str(exc), code="connection_inactive", status=exc.status))
        except ConnectionMismatchError as exc:
            checks.append(self._check("connected_account", "failed", str(exc), code="connection_toolkit_mismatch"))
        except ToolConnectionRequiredError as exc:
            checks.append(self._check("connected_account", "failed", str(exc), code="connection_required"))
        except ToolAccessDeniedError as exc:
            checks.append(self._check("connected_account", "failed", str(exc), code="connection_not_found"))
        except ToolValidationError as exc:
            checks.append(self._check("connected_account", "failed", str(exc), code="validation_error"))

        return {
            "tool": {"id": str(tool.id), "name": tool.name, "slug": tool.slug},
            "passed": all(check["status"] != "failed" for check in checks),
            "checks": checks,
            "connected_account_id": account.id if account else None,
            "_tool": tool,
            "_user_uuid": user_uuid,
        }

    async def dry_run(
        self,
        db: AsyncSession,
        tool_id: UUID,
        arguments: dict[str, Any],
        user_id: str,
        connected_account_id: str | None = None,
    ) -> dict[str, Any]:
        started_at = datetime.now(UTC)
        clock = time.perf_counter()
        report = await self.preflight(db, tool_id, arguments, user_id, connected_account_id)
        tool, user_uuid = report.pop("_tool"), report.pop("_user_uuid")
        failed = [check for check in report["checks"] if check["status"] == "failed"]
        tool_log("INFO", "COMPLETED", "DRY_RUN", "tool.dryrun.completed",report["tool"]["slug"], report["passed"], ",".join(check["name"] for check in failed) or "none",)
        await self._record_history(
            db,
            tool_id=tool.id,
            user_uuid=user_uuid,
            mode=MODE_DRY_RUN,
            status="success" if report["passed"] else "failed",
            arguments=arguments,
            output={"checks": report["checks"]},
            error={"type": "dry_run_failed", "message": "; ".join(f"{c['name']}: {c['message']}" for c in failed)} if failed else None,
            started_at=started_at,
            latency_ms=int((time.perf_counter() - clock) * 1000),
        )
        return {"mode": "dry_run", "executed": False, "execution": None, **report}

    async def live_test(
        self,
        db: AsyncSession,
        tool_id: UUID,
        arguments: dict[str, Any],
        user_id: str,
        connected_account_id: str | None = None,
        request_id: str | None = None,
    ) -> dict[str, Any]:
        """Pre-flight, then a REAL execution through the provider's test path. Only reachable with live=true."""
        report = await self.preflight(db, tool_id, arguments, user_id, connected_account_id)
        tool, user_uuid = report.pop("_tool"), report.pop("_user_uuid")
        if not report["passed"]:
            failed = [check for check in report["checks"] if check["status"] == "failed"]
            await self._record_history(
                db,
                tool_id=tool.id,
                user_uuid=user_uuid,
                mode=MODE_LIVE_TEST,
                status="failed",
                arguments=arguments,
                output={"checks": report["checks"]},
                error={"type": "preflight_failed", "message": "; ".join(f"{c['name']}: {c['message']}" for c in failed)},
                started_at=datetime.now(UTC),
                latency_ms=0,
            )
            return {"mode": "live", "executed": False, "execution": None, **report}

        result = await self.execute(db,tool_id,arguments,user_id,connected_account_id=report["connected_account_id"],request_id=request_id,mode=MODE_LIVE_TEST)
        return {
            "mode": "live",
            "executed": True,
            "execution": result,
            **report,
            "passed": result.success,
        }
