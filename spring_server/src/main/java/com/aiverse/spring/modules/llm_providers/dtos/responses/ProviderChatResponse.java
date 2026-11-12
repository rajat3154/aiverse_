package com.aiverse.spring.modules.llm_providers.dtos.responses;

import java.util.Map;

public record ProviderChatResponse(String content, String model, String provider, Map<String, Object> usage, String finishReason) {
}
