
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
