
from collections.abc import AsyncIterator, Sequence
from typing import Any

from google import genai
from google.genai import errors as genai_errors
from langchain_google_genai import ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings

from modules.llm_providers.base import (
    BaseLLMProvider,
    ProviderAuthenticationError,
    ProviderChatRequest,
    ProviderChatResponse,
    ProviderConfigurationError,
    ProviderEmbeddingResponse,
    ProviderError,
    ProviderModel,
    ProviderModelNotFoundError,
    ProviderOperationNotSupportedError,
)


class GeminiProvider(BaseLLMProvider):
    def __init__(self, context, manifest):
        super().__init__(context, manifest)
        self.api_key = self._get_api_key()

    def _get_api_key(self) -> str:
        for key in (
            "api_key",
            "google_api_key",
            "gemini_api_key",
            "GOOGLE_API_KEY",
            "GEMINI_API_KEY",
            "key",
        ):
            value = self.credential.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        raise ProviderAuthenticationError("Gemini API key is missing.")

    def _client_options(self) -> dict[str, Any]:
        return {
            "api_key": self.api_key,
            "http_options": {
                "timeout": int(self.context.timeout * 1000)
            },
        }

    def _validate_parameters(self, parameters: dict[str, Any] | None) -> dict[str, Any]:
        parameters = dict(parameters or {})
        reserved = {
            "api_key",
            "google_api_key",
            "gemini_api_key",
            "base_url",
            "model",
            "model_name",
            "timeout",
            "request_timeout",
            "vertexai",
            "project",
            "location",
            "credentials",
        }
        invalid = reserved.intersection(parameters)
        if invalid:
            raise ProviderConfigurationError(
                "Provider credentials and client settings cannot be passed as model parameters.",
                details={"invalid_parameters": sorted(invalid)},
            )
        return parameters

    def _handle_error(self, error: Exception) -> ProviderError:
        if isinstance(error, genai_errors.APIError):
            status = getattr(error, "code", None)
            message = getattr(error, "message", str(error))
            if status in (401, 403):
                return ProviderAuthenticationError(
                    "Gemini authentication or permission check failed."
                )
            if status == 404:
                return ProviderModelNotFoundError("requested model")
            if status == 429:
                return ProviderError(
                    message,
                    code="RATE_LIMITED",
                    retryable=True,
                    details={"status_code": status},
                )
            return ProviderError(
                message,
                code="GEMINI_API_ERROR",
                retryable=bool(status and status >= 500),
                details={"status_code": status},
            )
        return ProviderError(
            str(error),
            code="GEMINI_PROVIDER_ERROR",
            retryable=True,
        )

    def _fallback_models(self) -> list[ProviderModel]:
        fallback = (
            self.manifest
            .get("model_discovery", {})
            .get("fallback", {})
            .get("models", [])
        )
        models = []
        for item in fallback:
            if not isinstance(item, dict) or not item.get("id"):
                continue
            models.append(
                ProviderModel(
                    id=item["id"],
                    name=item.get("name", item["id"]),
                    description=item.get("description"),
                    capabilities=item.get("capabilities", {}),
                    context_window=item.get("context_window"),
                    max_output_tokens=item.get("max_output_tokens"),
                    input_modalities=item.get("input_modalities", ["text"]),
                    output_modalities=item.get("output_modalities", ["text"]),
                    metadata=item.get("metadata", {}),
                )
            )
        return models

    async def _close_client(self, client: Any) -> None:
        try:
            await client.aio.aclose()
        except Exception:
            pass

    async def validate_credentials(self) -> bool:
        client = genai.Client(**self._client_options())
        try:
            pager = await client.aio.models.list(
                config={"page_size": 1}
            )
            async for _ in pager:
                break
            return True
        except genai_errors.APIError as error:
            if getattr(error, "code", None) in (401, 403):
                return False
            raise self._handle_error(error) from error
        except Exception as error:
            raise self._handle_error(error) from error
        finally:
            await self._close_client(client)

    async def discover_models(self) -> list[ProviderModel]:
        client = genai.Client(**self._client_options())
        discovered = []

        try:
            pager = await client.aio.models.list(
                config={"page_size": 100}
            )

            async for item in pager:
                name = getattr(item, "name", None)
                if not name:
                    continue

                model_id = name.removeprefix("models/")
                supported_actions = (
                    getattr(item, "supported_actions", None) or []
                )
                supports_generation = (
                    "generateContent" in supported_actions
                )

                discovered.append(
                    ProviderModel(
                        id=model_id,
                        name=getattr(item, "display_name", None) or model_id,
                        description=getattr(item, "description", None),
                        capabilities={
                            "chat": supports_generation,
                            "streaming": supports_generation,
                            "embeddings": "embedContent" in supported_actions,
                            "vision": True,
                            "tool_calling": supports_generation,
                        },
                        context_window=getattr(
                            item, "input_token_limit", None
                        ),
                        max_output_tokens=getattr(
                            item, "output_token_limit", None
                        ),
                        input_modalities=["text"],
                        output_modalities=["text"],
                        metadata={
                            "supported_actions": supported_actions,
                            "model_version": getattr(
                                item, "version", None
                            ),
                            "base_model_id": getattr(
                                item, "base_model_id", None
                            ),
                        },
                    )
                )

            if discovered:
                return discovered

            fallback = self._fallback_models()
            if fallback:
                return fallback

            raise ProviderError(
                "Gemini returned no available models.",
                code="NO_MODELS_AVAILABLE",
            )

        except ProviderError:
            raise
        except Exception as error:
            fallback = self._fallback_models()
            if fallback and (
                not isinstance(error, genai_errors.APIError)
                or getattr(error, "code", 0) >= 500
                or getattr(error, "code", None) == 429
            ):
                return fallback
            raise self._handle_error(error) from error
        finally:
            await self._close_client(client)

    async def test_connection(self, model: str | None = None) -> bool:
        if not model:
            return await self.validate_credentials()

        llm = self.create_model(model)
        try:
            await llm.ainvoke("Reply with the word OK.")
            return True
        except Exception as error:
            raise self._handle_error(error) from error
        finally:
            close = getattr(llm, "aclose", None)
            if close:
                await close()

    def create_model(
        self,
        model: str,
        parameters: dict[str, Any] | None = None,
    ) -> ChatGoogleGenerativeAI:
        if not model or not isinstance(model, str):
            raise ProviderConfigurationError("A valid Gemini model ID is required.")

        model_parameters = self._validate_parameters(parameters)
        max_retries = model_parameters.pop("max_retries", 2)

        try:
            return ChatGoogleGenerativeAI(
                model=model,
                api_key=self.api_key,
                timeout=self.context.timeout,
                max_retries=max_retries,
                **model_parameters,
            )
        except Exception as error:
            raise ProviderConfigurationError(
                "Could not initialize the Gemini chat model.",
                details={"reason": str(error)},
            ) from error

    async def chat(
        self,
        request: ProviderChatRequest,
    ) -> ProviderChatResponse:
        llm = self.create_model(
            request.model,
            request.parameters,
        )
        try:
            response = await llm.ainvoke(list(request.messages))
            content = response.content

            if isinstance(content, list):
                content = "".join(
                    str(block.get("text", ""))
                    for block in content
                    if isinstance(block, dict) and block.get("type") == "text"
                )
            elif not isinstance(content, str):
                content = str(content)

            usage = getattr(response, "usage_metadata", None) or {}

            return ProviderChatResponse(
                content=content,
                model=request.model,
                provider=self.provider_key,
                usage=dict(usage) if usage else {},
                finish_reason=(
                    getattr(response, "response_metadata", {}) or {}
                ).get("finish_reason"),
                metadata={
                    "response_metadata": getattr(
                        response, "response_metadata", {}
                    ),
                    "tool_calls": getattr(response, "tool_calls", []),
                    "additional_kwargs": getattr(
                        response, "additional_kwargs", {}
                    ),
                },
            )
        except Exception as error:
            raise self._handle_error(error) from error
        finally:
            close = getattr(llm, "aclose", None)
            if close:
                await close()

    async def stream(
        self,
        request: ProviderChatRequest,
    ) -> AsyncIterator[Any]:
        llm = self.create_model(
            request.model,
            request.parameters,
        )
        try:
            async for chunk in llm.astream(list(request.messages)):
                if chunk.content:
                    yield chunk.content
        except Exception as error:
            raise self._handle_error(error) from error
        finally:
            close = getattr(llm, "aclose", None)
            if close:
                await close()

    async def create_embeddings(
        self,
        texts: Sequence[str],
        model: str,
        parameters: dict[str, Any] | None = None,
    ) -> ProviderEmbeddingResponse:
        if not texts:
            raise ProviderConfigurationError(
                "At least one text is required for embeddings."
            )

        parameters = dict(parameters or {})
        allowed = {
            "task_type",
            "output_dimensionality",
            "batch_size",
            "titles",
        }
        invalid = set(parameters) - allowed
        if invalid:
            raise ProviderConfigurationError(
                "Unsupported Gemini embedding parameters.",
                details={"invalid_parameters": sorted(invalid)},
            )

        embeddings_model = GoogleGenerativeAIEmbeddings(
            model=model,
            api_key=self.api_key,
        )

        try:
            vectors = await embeddings_model.aembed_documents(
                list(texts),
                **parameters,
            )
            return ProviderEmbeddingResponse(
                embeddings=vectors,
                model=model,
                provider=self.provider_key,
                usage={},
            )
        except Exception as error:
            raise self._handle_error(error) from error
