
import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

from opentelemetry import trace

from .context import get_context

_STANDARD_LOG_RECORD_FIELDS = set(logging.makeLogRecord({}).__dict__.keys()) | {
    "message",
    "asctime",
    "event_domain",
    "event_action",
    "event_outcome",
    "aiverse_context",
}

class AiverseJsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        span_context = trace.get_current_span().get_span_context()
        context = get_context()
        context.update(getattr(record, "aiverse_context", {}) or {})
        custom_fields = {
            key: value
            for key, value in record.__dict__.items()
            if key not in _STANDARD_LOG_RECORD_FIELDS
            and not key.startswith("_")
        }
        context.update(custom_fields)
        trace_id = (format(span_context.trace_id, "032x") if span_context.is_valid else context.get("trace_id"))
        span_id = (format(span_context.span_id, "016x") if span_context.is_valid else context.get("span_id"))
        context.pop("trace_id", None)
        context.pop("span_id", None)
        if trace_id:
            context["trace_id"] = trace_id
        if span_id:
            context["span_id"] = span_id
        error = None
        if record.exc_info:
            error = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "stack_trace": self.formatException(record.exc_info),
            }

        service = {
            "name": os.getenv("OTEL_SERVICE_NAME", "unknown_service"),
            "namespace": os.getenv("OTEL_SERVICE_NAMESPACE", "aiverse"),
            "version": os.getenv("AIVERSE_SERVICE_VERSION", "0.1.0"),
        }

        deployment = {"environment": os.getenv("OTEL_DEPLOYMENT_ENVIRONMENT",os.getenv("AIVERSE_ENVIRONMENT", "development"))}
        event = {
            "domain": getattr(record, "event_domain", "SYSTEM"),
            "action": getattr(record, "event_action", record.funcName.upper()),
            "outcome": getattr(
                record,
                "event_outcome",
                "FAILURE" if record.levelno >= logging.ERROR else "SUCCESS",
            ),
        }
        result: dict[str, Any] = {
            "timestamp": datetime.fromtimestamp(record.created, timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            "severity": record.levelname,
            "message": record.getMessage(),
            "service": service,
            "deployment": deployment,
            "event": event,
            "context": context,
            "error": error,
        }
        return json.dumps(result, default=str, ensure_ascii=False)


class AiversePrettyFormatter(logging.Formatter):
    """Local, human-readable format:
    datetime | level | aiverse | server | file/path.py:line | message
    """

    _COLORS = {
        "DEBUG": "\033[36m", "INFO": "\033[32m", "WARNING": "\033[33m",
        "ERROR": "\033[31m", "CRITICAL": "\033[1;31m",
    }
    _RESET, _DIM, _BLUE, _CYAN = "\033[0m", "\033[2m", "\033[34m", "\033[36m"

    def __init__(self, service_name: str | None = None, color: bool = True):
        super().__init__()
        self._service = service_name or os.getenv("OTEL_SERVICE_NAME", "ai_server")
        self._color = color

    def _c(self, text: str, code: str) -> str:
        return f"{code}{text}{self._RESET}" if self._color else text

    def format(self, record: logging.LogRecord) -> str:
        ts = datetime.fromtimestamp(record.created).strftime("%Y-%m-%d %H:%M:%S.") + f"{int(record.msecs):03d}"
        level = record.levelname if record.levelname != "WARNING" else "WARN"
        sep = self._c("|", self._DIM)
        try:
            path = os.path.relpath(record.pathname)
        except ValueError:  # different drive on Windows
            path = record.pathname
        if path.startswith(".."):
            path = record.pathname
        location = f"{path.replace(os.sep, '/')}:{record.lineno}"
        parts = [
            self._c(ts, self._DIM),
            self._c(f"{level:<5}", self._COLORS.get(record.levelname, "")),
            self._c("aiverse", self._BLUE),
            self._c(self._service, self._BLUE),
            self._c(f"{location:<70}", self._CYAN),
            record.getMessage(),
        ]
        line = f" {sep} ".join(parts)
        if record.exc_info:
            line += "\n" + self.formatException(record.exc_info)
        return line
