import logging
import os
from urllib.parse import unquote

from opentelemetry import _logs
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.resources import Resource

from .context import get_context

_provider: LoggerProvider | None = None

def _parse_headers(value: str) -> dict[str, str]:
    headers = {}
    for item in value.split(","):
        if "=" not in item:
            continue
        key, val = item.split("=", 1)
        headers[unquote(key.strip())] = unquote(val.strip())
    return headers

class AiverseContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        for key, value in get_context().items():
            if not hasattr(record, key):
                setattr(record, key, value)
        return True

def configure_otel_logging() -> logging.Handler | None:
    global _provider
    enabled = os.getenv("AIVERSE_LOG_OTLP_ENABLED", "false").lower() == "true"
    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    if not enabled or not endpoint:
        return None
    resource = Resource.create({
        "service.name": os.getenv("OTEL_SERVICE_NAME", "unknown_service"),
        "service.namespace": os.getenv("OTEL_SERVICE_NAMESPACE", "aiverse"),
        "service.version": os.getenv("AIVERSE_SERVICE_VERSION", "0.1.0"),
        "deployment.environment.name": os.getenv(
            "OTEL_DEPLOYMENT_ENVIRONMENT",
            os.getenv("AIVERSE_ENVIRONMENT", "development")
        )
    })
    headers = _parse_headers(os.getenv("OTEL_EXPORTER_OTLP_HEADERS", ""))
    exporter = OTLPLogExporter(
        endpoint=endpoint.rstrip("/") + "/v1/logs",
        headers=headers
    )
    _provider = LoggerProvider(resource=resource)
    _provider.add_log_record_processor(BatchLogRecordProcessor(exporter))
    _logs.set_logger_provider(_provider)
    handler = LoggingHandler(level=logging.NOTSET, logger_provider=_provider)
    handler.addFilter(AiverseContextFilter())
    return handler

def shutdown_otel_logging() -> None:
    if _provider:
        _provider.force_flush(timeout_millis=5000)
        _provider.shutdown()
