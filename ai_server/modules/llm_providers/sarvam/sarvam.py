
from collections.abc import AsyncIterator, Sequence
from typing import Any
from langchain_sarvam import ChatSarvam
from modules.llm_providers.base import  BaseLLMProvider, ProviderAuthenticationError, ProviderChatRequest, ProviderChatResponse, ProviderConfigurationError, ProviderError, ProviderModel, ProviderModelNotFoundError, ProviderOperationNotSupportedError



class SarvamProvider(BaseLLMProvider):
    def __init__(self, context, manifest):
        super().__init__(context, manifest)
        self.api_key = self._get_api_key()
        self.base_url = self.configuration.get("base_url")

    def _get_api_key(self) -> str:
        for key in ("api_key", "sarvam_api_key", "SARVAM_API_KEY", "key"):
            value = self.credential.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        raise ProviderAuthenticationError("Sarvam API key is missing.")

    def _validate_parameters(self, parameters: dict[str, Any] | None) -> dict[str, Any]:
        parameters = dict(parameters or {})
        reserved = {
            "api_key",
            "sarvam_api_key",
            "base_url",
            "model",
            "model_name"
        }
        invalid = reserved.intersection(parameters)
        if invalid:
            raise ProviderConfigurationError(
                "Provider credentials and model settings cannot be overridden.",
                details={"invalid_parameters": sorted(invalid)}
            )
        allowed = {
            field["key"]
            for field in self.manifest.get("parameters", {}).get("fields", [])
        }
        unknown = set(parameters) - allowed
        if unknown:
            raise ProviderConfigurationError(
                "Unsupported Sarvam model parameters.",
                details={"unsupported_parameters": sorted(unknown)}
            )
        return parameters

    def _handle_error(self, error: Exception) -> ProviderError:
        message = str(error)
        lowered = message.lower()

        if any(value in lowered for value in ("401", "403", "unauthorized", "invalid api key", "authentication")):
            return ProviderAuthenticationError("Sarvam authentication failed.")

        if "429" in lowered or "rate limit" in lowered:
            return ProviderError(
                message="Sarvam rate limit exceeded.",
                code="RATE_LIMITED",
                retryable=True
            )

        if any(value in lowered for value in ("connection", "timeout", "network")):
            return ProviderError(
                message="Unable to connect to Sarvam.",
                code="CONNECTION_ERROR",
                retryable=True
            )

        if "404" in lowered or "model not found" in lowered:
            return ProviderModelNotFoundError("requested model")

        return ProviderError(
            message="Sarvam request failed.",
            code="SARVAM_PROVIDER_ERROR",
            retryable=False,
            details={"error": message}
        )

    def _fallback_models(self) -> list[ProviderModel]:
        discovery = self.manifest.get("model_discovery", {})
        fallback = discovery.get("fallback", {})
        models = []

        for item in fallback.get("models", []):
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
                    metadata=item.get("metadata", {})
                )
            )

        return models

    async def validate_credentials(self) -> bool:
        try:
            model = self.create_model(
                model=self.manifest["model_discovery"]["fallback"]["models"][0]["id"],
                parameters={"max_tokens": 1}
            )
            await model.ainvoke("Reply with one character.")
            return True
        except Exception as error:
            mapped = self._handle_error(error)
            if isinstance(mapped, ProviderAuthenticationError):
                return False
            raise mapped from error

    async def discover_models(self) -> list[ProviderModel]:
        models = self._fallback_models()
        if not models:
            raise ProviderError(
                "No Sarvam models are configured in the provider manifest.",
                code="MODEL_CATALOG_EMPTY"
            )
        return models

    async def test_connection(self, model: str | None = None) -> bool:
        if model is None:
            return await self.validate_credentials()

        try:
            chat_model = self.create_model(model, {"max_tokens": 1})
            await chat_model.ainvoke("Reply with one character.")
            return True
        except Exception as error:
            raise self._handle_error(error) from error

    def create_model(
        self,
        model: str,
        parameters: dict[str, Any] | None = None
    ) -> Any:
        available_models = {item.id for item in self._fallback_models()}
        if model not in available_models:
            raise ProviderModelNotFoundError(model)

        model_parameters = self._validate_parameters(parameters)

        options = {
            "model": model,
            "api_key": self.api_key,
            **model_parameters
        }

        if self.base_url:
            options["base_url"] = self.base_url

        try:
            return ChatSarvam(**options)
        except Exception as error:
            raise ProviderConfigurationError(
                "Unable to initialize the Sarvam chat model.",
                details={"error": str(error)}
            ) from error

    async def chat(self, request: ProviderChatRequest) -> ProviderChatResponse:
        try:
            model = self.create_model(request.model, request.parameters)
            response = await model.ainvoke(list(request.messages))

            usage = response.usage_metadata or {}

            return ProviderChatResponse(
                content=response.content if isinstance(response.content, str) else str(response.content),
                model=request.model,
                provider=self.provider_key,
                usage=usage,
                finish_reason=response.response_metadata.get("finish_reason"),
                metadata={
                    "response_metadata": response.response_metadata,
                    "additional_kwargs": response.additional_kwargs
                }
            )
        except Exception as error:
            if isinstance(error, ProviderError):
                raise
            raise self._handle_error(error) from error

    async def stream(self, request: ProviderChatRequest) -> AsyncIterator[Any]:
        try:
            model = self.create_model(request.model, request.parameters)
            async for chunk in model.astream(list(request.messages)):
                if chunk.content:
                    yield chunk.content
        except Exception as error:
            if isinstance(error, ProviderError):
                raise
            raise self._handle_error(error) from error

    async def create_embeddings(
        self,
        texts: Sequence[str],
        model: str,
        parameters: dict[str, Any] | None = None
    ):
        raise ProviderOperationNotSupportedError("embeddings")
