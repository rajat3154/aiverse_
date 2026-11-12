
from collections.abc import AsyncIterator, Sequence
from typing import Any
from openai import APIConnectionError, APIStatusError, AsyncOpenAI, AuthenticationError, RateLimitError
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from modules.llm_providers.base import  BaseLLMProvider, ProviderAuthenticationError, ProviderChatRequest, ProviderChatResponse, ProviderConfigurationError, ProviderEmbeddingResponse, ProviderError, ProviderModel, ProviderModelNotFoundError, ProviderOperationNotSupportedError



class OpenRouterProvider(BaseLLMProvider):
    DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"

    def __init__(self, context, manifest):
        super().__init__(context, manifest)
        self.api_key = self._get_api_key()
        self.base_url = (self.configuration.get("base_url") or self.DEFAULT_BASE_URL)
        self.site_url = self.configuration.get("site_url")
        self.app_name = self.configuration.get("app_name", "AIVERSE")

    def _get_api_key(self) -> str:
        for key in ("api_key","openrouter_api_key","OPENROUTER_API_KEY","key"):
            value = self.credential.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        raise ProviderAuthenticationError("OpenRouter API key is missing.")

    def _default_headers(self) -> dict[str, str]:
        headers = {}
        if self.site_url:
            headers["HTTP-Referer"] = self.site_url
        if self.app_name:
            headers["X-Title"] = self.app_name
        return headers

    def _client_options(self) -> dict[str, Any]:
        options = {
            "api_key": self.api_key,
            "base_url": self.base_url,
            "timeout": self.context.timeout
        }
        headers = self._default_headers()
        if headers:
            options["default_headers"] = headers
        return options

    def _validate_parameters(self,parameters: dict[str, Any] | None) -> dict[str, Any]:
        parameters = dict(parameters or {})
        reserved = {
            "api_key",
            "openrouter_api_key",
            "base_url",
            "timeout",
            "model",
            "model_name",
            "default_headers"
        }
        invalid = reserved.intersection(parameters)
        if invalid:
            raise ProviderConfigurationError("Connection settings cannot be passed as model parameters.",details={"invalid_parameters": sorted(invalid)})
        return parameters

    def _handle_error(self, error: Exception) -> ProviderError:
        if isinstance(error, AuthenticationError):
            return ProviderAuthenticationError("OpenRouter authentication failed. Check your API key.")
        if isinstance(error, RateLimitError):
            return ProviderError(
                message="OpenRouter rate limit or quota exceeded.",
                code="RATE_LIMITED",
                retryable=True
            )
        if isinstance(error, APIConnectionError):
            return ProviderError(
                message="Unable to connect to OpenRouter.",
                code="CONNECTION_ERROR",
                retryable=True
            )
        if isinstance(error, APIStatusError):
            status = error.status_code
            if status == 404:
                return ProviderModelNotFoundError("requested model")
            return ProviderError(
                message=f"OpenRouter API request failed with status {status}.",
                code="OPENROUTER_API_ERROR",
                retryable=status >= 500,
                details={"status_code": status}
            )
        return ProviderError(
            message=str(error) or "OpenRouter request failed.",
            code="OPENROUTER_PROVIDER_ERROR",
            retryable=False
        )

    def _fallback_models(self) -> list[ProviderModel]:
        fallback = (self.manifest.get("model_discovery", {}).get("fallback", {}).get("models", []))
        return [
            ProviderModel(
                id=model["id"],
                name=model.get("name", model["id"]),
                description=model.get("description"),
                capabilities=model.get("capabilities", {}),
                context_window=model.get("context_window"),
                max_output_tokens=model.get("max_output_tokens"),
                input_modalities=model.get("input_modalities", ["text"]),
                output_modalities=model.get("output_modalities", ["text"]),
                metadata=model.get("metadata", {})
            )
            for model in fallback
            if isinstance(model, dict) and model.get("id")
        ]

    def _map_model(self, model: Any) -> ProviderModel:
        architecture = getattr(model, "architecture", None) or {}
        top_provider = getattr(model, "top_provider", None) or {}
        supported_parameters = getattr(model,"supported_parameters",None) or []
        if not isinstance(architecture, dict):
            architecture = {}
        if not isinstance(top_provider, dict):
            top_provider = {}
        input_modalities = architecture.get("input_modalities",["text"])
        output_modalities = architecture.get("output_modalities",["text"])
        supported = set(supported_parameters)
        return ProviderModel(
            id=model.id,
            name=getattr(model, "name", None) or model.id,
            description=getattr(model, "description", None),
            capabilities={
                "chat": True,
                "streaming": True,
                "tool_calling": "tools" in supported,
                "structured_output": "structured_outputs" in supported,
                "image_input": "image" in input_modalities,
                "image_output": "image" in output_modalities,
                "audio_input": "audio" in input_modalities,
                "audio_output": "audio" in output_modalities,
                "reasoning": "reasoning" in supported
            },
            context_window=getattr(model, "context_length", None),
            max_output_tokens=top_provider.get(
                "max_completion_tokens"
            ),
            input_modalities=input_modalities,
            output_modalities=output_modalities,
            metadata={
                "canonical_slug": getattr(
                    model,
                    "canonical_slug",
                    None
                ),
                "pricing": getattr(model, "pricing", None),
                "supported_parameters": list(supported_parameters),
                "created": getattr(model, "created", None),
                "top_provider": top_provider
            }
        )

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
                self._map_model(model)
                for model in response.data
            ]
            if models:
                return models
            return self._fallback_models()
        except AuthenticationError as error:
            raise self._handle_error(error) from error
        except (APIConnectionError, RateLimitError) as error:
            fallback = self._fallback_models()
            if fallback:
                return fallback
            raise self._handle_error(error) from error
        except APIStatusError as error:
            if error.status_code >= 500:
                fallback = self._fallback_models()
                if fallback:
                    return fallback
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
            raise self._handle_error(error) from error

    def create_model(
        self,
        model: str,
        parameters: dict[str, Any] | None = None
    ) -> ChatOpenAI:
        if not model or not model.strip():
            raise ProviderConfigurationError(
                "An OpenRouter model ID is required."
            )

        model_parameters = self._validate_parameters(parameters)
        max_retries = model_parameters.pop("max_retries", 2)

        return ChatOpenAI(
            model=model,
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=self.context.timeout,
            max_retries=max_retries,
            default_headers=self._default_headers() or None,
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
            response = await model.ainvoke(request.messages)

            usage = response.usage_metadata or {}
            metadata = {
                "response_metadata": response.response_metadata,
                "additional_kwargs": response.additional_kwargs
            }

            return ProviderChatResponse(
                content=(
                    response.content
                    if isinstance(response.content, str)
                    else str(response.content)
                ),
                model=request.model,
                provider=self.provider_key,
                usage=usage,
                finish_reason=response.response_metadata.get(
                    "finish_reason"
                ),
                metadata=metadata
            )
        except Exception as error:
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
            async for chunk in model.astream(request.messages):
                if chunk.content:
                    yield chunk.content
        except Exception as error:
            raise self._handle_error(error) from error

    async def create_embeddings(
        self,
        texts: Sequence[str],
        model: str,
        parameters: dict[str, Any] | None = None
    ) -> ProviderEmbeddingResponse:
        if not texts:
            raise ProviderConfigurationError(
                "At least one text is required for embeddings."
            )

        embedding_parameters = self._validate_parameters(parameters)
        max_retries = embedding_parameters.pop("max_retries", 2)

        allowed = {
            "dimensions",
            "encoding_format",
            "chunk_size",
            "check_embedding_ctx_length",
            "show_progress_bar"
        }
        invalid = set(embedding_parameters) - allowed
        if invalid:
            raise ProviderConfigurationError(
                "Unsupported embedding parameters.",
                details={"invalid_parameters": sorted(invalid)}
            )

        try:
            embeddings_model = OpenAIEmbeddings(
                model=model,
                api_key=self.api_key,
                base_url=self.base_url,
                timeout=self.context.timeout,
                max_retries=max_retries,
                default_headers=self._default_headers() or None,
                **embedding_parameters
            )
            vectors = await embeddings_model.aembed_documents(
                list(texts)
            )
            return ProviderEmbeddingResponse(
                embeddings=vectors,
                model=model,
                provider=self.provider_key,
                usage={},
                metadata={
                    "embedding_count": len(vectors)
                }
            )
        except Exception as error:
            raise self._handle_error(error) from error
