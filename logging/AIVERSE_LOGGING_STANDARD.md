# AIVERSE Logging Standard

## 1. Purpose
A common structured logging contract for all AIVERSE services, independent of the logging backend.

## 2. Services
| Service | service.name |
|---|---|
| Gateway | gateway_server |
| Spring | spring_server |
| AI | ai_server |
| Flowable | flowable_server |

## 3. Required fields
- timestamp: ISO-8601 UTC timestamp
- severity: TRACE, DEBUG, INFO, WARN, ERROR, FATAL
- message: human-readable event description
- service.name: unique service identifier
- service.namespace: aiverse
- deployment.environment: development, staging, production
- event.domain: functional area
- event.action: operation being performed
- event.outcome: SUCCESS, FAILURE, STARTED, COMPLETED, REJECTED, TIMEOUT, RETRYING

## 4. Context fields
- request_id
- trace_id
- span_id
- user_id

Context fields must not contain credentials, secrets, or sensitive personal data.

## 5. Event domains
SYSTEM, AUTH, USER, ORGANIZATION, DATABASE, API, AGENT, LLM, WORKFLOW, TOOL, INTEGRATION, MESSAGE, STORAGE, SECURITY, OBSERVABILITY.

## 6. Severity rules
- TRACE: highly detailed execution diagnostics
- DEBUG: developer diagnostics
- INFO: normal application events
- WARN: recoverable or unexpected conditions
- ERROR: failed operations
- FATAL: critical failures requiring service-level attention

## 7. Export
- Console output remains enabled.
- OpenTelemetry exports logs using OTLP HTTP/protobuf.
- Grafana Cloud Loki is the initial centralized destination.
- Export failures must not interrupt application requests.
- Secrets must never be logged.

## 8. Environment variables
- AIVERSE_ENVIRONMENT
- AIVERSE_LOG_LEVEL
- AIVERSE_LOG_FORMAT
- AIVERSE_LOG_CONSOLE
- AIVERSE_LOG_OTLP_ENABLED
- OTEL_EXPORTER_OTLP_ENDPOINT
- OTEL_EXPORTER_OTLP_HEADERS
- OTEL_EXPORTER_OTLP_PROTOCOL
- OTEL_SERVICE_NAME
- OTEL_SERVICE_NAMESPACE
- OTEL_DEPLOYMENT_ENVIRONMENT

## 9. Compatibility
Python and Java implementations must follow this contract while using native logging APIs and OpenTelemetry SDKs.
