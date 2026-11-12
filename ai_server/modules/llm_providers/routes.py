"""Server-to-server endpoint used by the Spring server to run a chat with a saved provider configuration.

Spring owns the credentials: it decrypts the key and sends it here for this one call. The key is only used to build the
provider client in memory and is never logged or stored. The endpoint is protected by a shared token (AI_INTERNAL_TOKEN)
and refuses every request when that token is not configured.
"""

import hmac
import os
import time
from typing import Any

from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from aiverse_logging import get_logger, log_event
from configurations.databases.database import AsyncSessionLocal
from configurations.messages import get_message
from modules.llm_providers.base import (
    ProviderAuthenticationError,
    ProviderChatRequest,
    ProviderConfigurationError,
    ProviderError,
    ProviderModelNotFoundError,
    ProviderOperationNotSupportedError,
)
from modules.llm_providers.factory import llm_provider_factory

log = get_logger("aiverse.ai_server.llm_providers")

router = APIRouter(prefix="/internal/llm", tags=["LLM Providers (internal)"])


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(system|user|assistant)$")
    content: str = Field(min_length=1, max_length=20000)


class ChatPayload(BaseModel):
    provider_key: str
    model: str = Field(min_length=1, max_length=255)
    messages: list[ChatMessage] = Field(min_length=1, max_length=50)
    configuration: dict[str, Any] = Field(default_factory=dict)
    parameters: dict[str, Any] = Field(default_factory=dict)
    credential: dict[str, Any] = Field(default_factory=dict)
    user_id: str | None = None


def _error(status: int, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"message": message})


def _authorized(token: str | None) -> bool:
    expected = os.getenv("AI_INTERNAL_TOKEN", "")
    return bool(expected) and token is not None and hmac.compare_digest(token, expected)


def _log(level: str, outcome: str, key: str, *args, context: dict | None = None, exc_info: bool = False) -> None:
    # never put the credential, the messages or the model output in a log line: only identifiers, sizes and timings
    log_event(log, level, get_message(key, *args), domain="LLM", action="TEST_CHAT", outcome=outcome, context=context, exc_info=exc_info)


@router.post("/chat")
async def chat(payload: ChatPayload, x_internal_token: str | None = Header(default=None)):
    if not os.getenv("AI_INTERNAL_TOKEN"):
        _log("ERROR", "FAILURE", "llm.chat.unconfigured")
        return _error(503, "AI_INTERNAL_TOKEN is not configured on the AI server.")
    if not _authorized(x_internal_token):
        _log("WARNING", "FAILURE", "llm.chat.unauthorized")
        return _error(401, "Invalid internal token.")

    provider_key = payload.provider_key.strip().upper()
    context = {
        "provider_key": provider_key,
        "model": payload.model,
        "message_count": len(payload.messages),
        "user_id": payload.user_id,
        "has_credential": bool(payload.credential),
        "parameter_keys": sorted(payload.parameters),
        "configuration_keys": sorted(payload.configuration),
    }
    started_at = time.monotonic()
    _log("INFO", "STARTED", "llm.chat.started", provider_key, payload.model, len(payload.messages), context=context)

    def duration() -> float:
        return round((time.monotonic() - started_at) * 1000, 2)

    try:
        async with AsyncSessionLocal() as session:
            provider = await llm_provider_factory.create(
                session,
                payload.provider_key,
                configuration=payload.configuration,
                credential=payload.credential,
                user_id=payload.user_id,
            )
        response = await provider.chat(
            ProviderChatRequest(
                model=payload.model,
                messages=[message.model_dump() for message in payload.messages],
                parameters=payload.parameters,
            )
        )
    except ProviderAuthenticationError as error:
        _log("WARNING", "FAILURE", "llm.chat.rejected", provider_key, payload.model, error.code, "authentication", context={**context, "duration_ms": duration(), "error_code": error.code})
        return _error(401, str(error))
    except ProviderModelNotFoundError as error:
        _log("WARNING", "FAILURE", "llm.chat.rejected", provider_key, payload.model, error.code, "model not found", context={**context, "duration_ms": duration(), "error_code": error.code})
        return _error(404, str(error))
    except (ProviderConfigurationError, ProviderOperationNotSupportedError) as error:
        _log("WARNING", "FAILURE", "llm.chat.rejected", provider_key, payload.model, error.code, "configuration", context={**context, "duration_ms": duration(), "error_code": error.code, "details": error.details})
        return _error(400, str(error))
    except ProviderError as error:
        _log("WARNING", "FAILURE", "llm.chat.rejected", provider_key, payload.model, error.code, "provider error", context={**context, "duration_ms": duration(), "error_code": error.code, "retryable": error.retryable})
        return _error(502, str(error))
    except Exception:
        # the response message is generic on purpose: provider exceptions can echo request details
        _log("ERROR", "FAILURE", "llm.chat.failed", provider_key, payload.model, context={**context, "duration_ms": duration()}, exc_info=True)
        return _error(500, "The provider could not generate a response.")

    usage = response.usage or {}
    _log(
        "INFO",
        "COMPLETED",
        "llm.chat.completed",
        provider_key,
        payload.model,
        response.finish_reason,
        usage.get("total_tokens"),
        context={**context, "duration_ms": duration(), "finish_reason": response.finish_reason, "total_tokens": usage.get("total_tokens"), "response_chars": len(response.content or "")},
    )
    return {
        "content": response.content,
        "model": response.model,
        "provider": response.provider,
        "usage": usage,
        "finish_reason": response.finish_reason,
    }
