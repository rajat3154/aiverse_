from aiverse_logging import get_logger, log_event
from configurations.messages import get_message

log = get_logger("aiverse.ai_server.handlers")

DOMAIN = "MESSAGE"
ACTION = "HANDLE_AI_REQUEST"


def _log(level, key, outcome, *args, exc_info=False):
    log_event(log, level, get_message(key, *args), domain=DOMAIN, action=ACTION, outcome=outcome, exc_info=exc_info)


async def handle_ai_request(data: dict):
    event_type = data.get("event_type", "AI_REQUEST")
    event_id = data.get("event_id") or data.get("request_id")
    source = data.get("source")
    payload = data.get("payload", data)

    status = payload.get("status") if isinstance(payload, dict) else None
    error = payload.get("error") if isinstance(payload, dict) else None
    result_data = payload.get("data") if isinstance(payload, dict) else None

    try:
        _log("INFO", "event.ai_request.started", "STARTED", event_type, event_id, source)
        _log("DEBUG", "event.ai_request.payload", "STARTED", payload)

        outputs = {"event_type": event_type, "event_id": event_id, "processed": True}
        if status is not None:
            _log("DEBUG", "event.ai_request.status", "STARTED", status)
            outputs["status"] = status
        if result_data is not None:
            outputs["data"] = result_data

        if error is not None:
            _log("ERROR", "event.ai_request.reported_failure", "FAILURE", event_type, event_id, error)
        else:
            _log("INFO", "event.ai_request.processed", "COMPLETED", event_type, event_id)

        return outputs
    except Exception as exc:
        _log("ERROR", "event.ai_request.failed", "FAILURE", event_type, event_id, exc, exc_info=True)
        raise
