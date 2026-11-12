
from collections.abc import AsyncIterator, Sequence
from typing import Any

from anthropic import (
    APIConnectionError,
    APIStatusError,
    AsyncAnthropic,
    AuthenticationError,
    RateLimitError
)
from langchain_anthropic import ChatAnthropic

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
    ProviderOperationNotSupportedError
)


class AnthropicProvider(BaseLLMProvider):
    """Anthropic provider implementation."""

    def __init__(self, context, manifest: dict[str, Any]):
        super().__init__(context, manifest)
        self.api_key = self._get_api_key()
        self.base_url = self.configuration.get("base_url")

    def _get_api_key(self) -> str:
        for key in (
            "api_key",
            "anthropic_api_key",
            "ANTHROPIC_API_KEY",
            "key"
        ):
            value = self.credential.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()

        raise ProviderAuthenticationError(
            "Anthropic API key is missing."
        )

    def _client_options(self) -> dict[str, Any]:
        options: dict[str, Any] = {
            "api_key": self.api_key,
            "timeout": self.context.timeout
        }

        if self.base_url:
            options["base_url"] = self.base_url

        return options

    def _validate_parameters(
        self,
        parameters: dict[str, Any] | None
    ) -> dict[str, Any]:
        parameters = dict(parameters or {})

        reserved = {
            "api_key",
            "anthropic_api_key",
            "base_url",
            "anthropic_api_url",
            "timeout",
            "default_request_timeout",
            "model",
            "model_name"
        }

        invalid = reserved.intersection(parameters)

        if invalid:
            raise ProviderConfigurationError(
                "Connection settings cannot be overridden through model parameters.",
                details={"invalid_parameters": sorted(invalid)}
            )

        return parameters

    def _handle_error(self, error: Exception) -> ProviderError:
        if isinstance(error, AuthenticationError):
            return ProviderAuthenticationError(
                "Anthropic rejected the supplied API key."
            )

        if isinstance(error, RateLimitError):
            return ProviderError(
                str(error),
                code="RATE_LIMITED",
                retryable=True
            )

        if isinstance(error, APIConnectionError):
            return ProviderError(
                str(error),
                code="CONNECTION_ERROR",
                retryable=True
            )

        if isinstance(error, APIStatusError):
            if error.status_code == 404:
                return ProviderModelNotFoundError("requested model")

            return ProviderError(
                str(error),
                code="ANTHROPIC_API_ERROR",
                retryable=error.status_code >= 500,
                details={"status_code": error.status_code}
            )

        return ProviderError(
            str(error),
            code="ANTHROPIC_PROVIDER_ERROR",
            retryable=False
        )

    def _fallback_models(self) -> list[ProviderModel]:
        discovery = self.manifest.get("model_discovery", {})
        fallback = discovery.get("fallback", {})

        if not fallback.get("enabled", False):
            return []

        return [
            ProviderModel(
                id=item["id"],
                name=item["name"],
                description=item.get("description"),
                capabilities=item.get("capabilities", {}),
                context_window=item.get("context_window"),
                max_output_tokens=item.get("max_output_tokens"),
                input_modalities=item.get("input_modalities", ["text"]),
                output_modalities=item.get("output_modalities", ["text"]),
                metadata=item.get("metadata", {})
            )
            for item in fallback.get("models", [])
        ]

    async def validate_credentials(self) -> bool:
        client = AsyncAnthropic(**self._client_options())

        try:
            await client.models.list(limit=1)
            return True

        except AuthenticationError:
            return False

        except Exception as error:
            raise self._handle_error(error) from error

        finally:
            await client.close()

    async def discover_models(self) -> list[ProviderModel]:
        client = AsyncAnthropic(**self._client_options())

        try:
            models: list[ProviderModel] = []
            after_id = None

            while True:
                response = await client.models.list(
                    limit=1000,
                    after_id=after_id
                )

                for model in response.data:
                    lifecycle = getattr(model, "lifecycle", None)

                    if lifecycle == "retired":
                        continue

                    models.append(
                        ProviderModel(
                            id=model.id,
                            name=getattr(
                                model,
                                "display_name",
                                model.id
                            ),
                            context_window=getattr(
                                model,
                                "max_input_tokens",
                                None
                            ),
                            max_output_tokens=getattr(
                                model,
                                "max_tokens",
                                None
                            ),
                            input_modalities=["text", "image"],
                            output_modalities=["text"],
                            metadata={
                                "created_at": str(
                                    getattr(model, "created_at", "")
                                ),
                                "lifecycle": lifecycle,
                                "capabilities": getattr(
                                    model,
                                    "capabilities",
                                    None
                                )
                            }
                        )
                    )

                if not getattr(response, "has_more", False):
                    break

                next_after_id = getattr(response, "last_id", None)

                if not next_after_id or next_after_id == after_id:
                    break

                after_id = next_after_id

            if models:
                return models

            return self._fallback_models()

        except AuthenticationError:
            raise ProviderAuthenticationError(
                "Anthropic rejected the supplied API key."
            )

        except (APIConnectionError, RateLimitError) as error:
            fallback_models = self._fallback_models()

            if fallback_models:
                return fallback_models

            raise self._handle_error(error) from error

        except APIStatusError as error:
            if error.status_code >= 500:
                fallback_models = self._fallback_models()

                if fallback_models:
                    return fallback_models

            raise self._handle_error(error) from error

        except Exception as error:
            raise self._handle_error(error) from error

        finally:
            await client.close()

    async def test_connection(self, model: str | None = None) -> bool:
        if not model:
            return await self.validate_credentials()

        try:
            chat_model = self.create_model(model)

            await chat_model.ainvoke(
                [{"role": "user", "content": "Reply with OK."}]
            )

            return True

        except Exception as error:
            if isinstance(error, ProviderError):
                raise

            raise self._handle_error(error) from error

    def create_model(
        self,
        model: str,
        parameters: dict[str, Any] | None = None
    ) -> ChatAnthropic:
        if not isinstance(model, str) or not model.strip():
            raise ProviderModelNotFoundError(str(model))

        model_parameters = self._validate_parameters(parameters)

        max_retries = model_parameters.pop("max_retries", 2)

        return ChatAnthropic(
            model=model.strip(),
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=self.context.timeout,
            max_retries=max_retries,
            **model_parameters
        )

    async def chat(
        self,
        request: ProviderChatRequest
    ) -> ProviderChatResponse:
        try:
            model = self.create_model(
                request.model,
                request.parameters
            )

            response = await model.ainvoke(
                list(request.messages)
            )

            content = response.content

            if not isinstance(content, str):
                content = str(content)

            response_metadata = response.response_metadata or {}

            return ProviderChatResponse(
                content=content,
                model=request.model,
                provider=self.provider_key,
                usage=response.usage_metadata or {},
                finish_reason=response_metadata.get("stop_reason"),
                metadata={
                    "response_metadata": response_metadata,
                    "additional_kwargs": response.additional_kwargs
                }
            )

        except Exception as error:
            if isinstance(error, ProviderError):
                raise

            raise self._handle_error(error) from error

    async def stream(
        self,
        request: ProviderChatRequest
    ) -> AsyncIterator[Any]:
        try:
            model = self.create_model(
                request.model,
                request.parameters
            )

            async for chunk in model.astream(
                list(request.messages)
            ):
                content = chunk.content

                if content:
                    yield content

        except Exception as error:
            if isinstance(error, ProviderError):
                raise

            raise self._handle_error(error) from error

    async def create_embeddings(
        self,
        texts: Sequence[str],
        model: str,
        parameters: dict[str, Any] | None = None
    ) -> ProviderEmbeddingResponse:
        raise ProviderOperationNotSupportedError("embeddings")
