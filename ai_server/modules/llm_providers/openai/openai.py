
from collections.abc import AsyncIterator, Sequence
from typing import Any

from openai import (
    APIConnectionError,
    APIStatusError,
    AsyncOpenAI,
    AuthenticationError,
    RateLimitError
)
from langchain_openai import ChatOpenAI, OpenAIEmbeddings

from modules.llm_providers.base import (
    BaseLLMProvider,
    ProviderAuthenticationError,
    ProviderChatRequest,
    ProviderChatResponse,
    ProviderConfigurationError,
    ProviderEmbeddingResponse,
    ProviderError,
    ProviderModel,
    ProviderModelNotFoundError
)


class OpenAIProvider(BaseLLMProvider):
    """OpenAI provider implementation."""

    def __init__(self, context, manifest: dict[str, Any]):
        super().__init__(context, manifest)
        self.api_key = self._get_api_key()
        self.base_url = self.configuration.get("base_url")
        self.organization = self.configuration.get("organization")
        self.project = self.configuration.get("project")

    def _get_api_key(self) -> str:
        for key in ("api_key", "openai_api_key", "OPENAI_API_KEY", "key"):
            value = self.credential.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        raise ProviderAuthenticationError("OpenAI API key is missing.")

    def _client_options(self) -> dict[str, Any]:
        options: dict[str, Any] = {
            "api_key": self.api_key,
            "timeout": self.context.timeout
        }
        if self.base_url:
            options["base_url"] = self.base_url
        if self.organization:
            options["organization"] = self.organization
        if self.project:
            options["project"] = self.project
        return options

    def _validate_parameters(self, parameters: dict[str, Any] | None) -> dict[str, Any]:
        parameters = parameters or {}
        reserved = {
            "api_key",
            "base_url",
            "organization",
            "project",
            "timeout",
            "model"
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
                "OpenAI rejected the supplied API key."
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
            return ProviderError(
                str(error),
                code="OPENAI_API_ERROR",
                retryable=error.status_code >= 500,
                details={"status_code": error.status_code}
            )
        return ProviderError(
            str(error),
            code="OPENAI_PROVIDER_ERROR",
            retryable=False
        )

    def _fallback_models(self) -> list[ProviderModel]:
        discovery = self.manifest.get("model_discovery", {})
        fallback = discovery.get("fallback", {})
        if not fallback.get("enabled", False):
            return []

        models = []
        for item in fallback.get("models", []):
            models.append(
                ProviderModel(
                    id=item["id"],
                    name=item["name"],
                    description=item.get("description"),
                    capabilities=item.get("capabilities", {}),
                    context_window=item.get("context_window"),
                    max_output_tokens=item.get("max_output_tokens"),
                    input_modalities=item.get("input_modalities", []),
                    output_modalities=item.get("output_modalities", []),
                    metadata=item.get("metadata", {})
                )
            )
        return models

    async def validate_credentials(self) -> bool:
        client = AsyncOpenAI(**self._client_options())
        try:
            await client.models.list()
            return True
        except AuthenticationError:
            return False
        except Exception as error:
            raise self._handle_error(error) from error
        finally:
            await client.close()

    async def discover_models(self) -> list[ProviderModel]:
        client = AsyncOpenAI(**self._client_options())
        try:
            response = await client.models.list()
            models = [
                ProviderModel(
                    id=model.id,
                    name=model.id,
                    metadata={
                        "owned_by": model.owned_by,
                        "created": model.created
                    }
                )
                for model in response.data
            ]
            if models:
                return models
            return self._fallback_models()
        except AuthenticationError:
            raise ProviderAuthenticationError(
                "OpenAI rejected the supplied API key."
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
    ) -> ChatOpenAI:
        if not isinstance(model, str) or not model.strip():
            raise ProviderModelNotFoundError(str(model))
        model_parameters = self._validate_parameters(parameters)
        return ChatOpenAI(
            model=model.strip(),
            **self._client_options(),
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
            response = await model.ainvoke(list(request.messages))
            content = response.content
            if not isinstance(content, str):
                content = str(content)
            return ProviderChatResponse(
                content=content,
                model=request.model,
                provider=self.provider_key,
                usage=response.usage_metadata or {},
                finish_reason=response.response_metadata.get("finish_reason"),
                metadata={
                    "response_metadata": response.response_metadata
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
            async for chunk in model.astream(list(request.messages)):
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
        try:
            model_parameters = self._validate_parameters(parameters)
            embeddings_model = OpenAIEmbeddings(
                model=model,
                **self._client_options(),
                **model_parameters
            )
            embeddings = await embeddings_model.aembed_documents(list(texts))
            return ProviderEmbeddingResponse(
                embeddings=embeddings,
                model=model,
                provider=self.provider_key
            )
        except Exception as error:
            if isinstance(error, ProviderError):
                raise
            raise self._handle_error(error) from error
