package com.aiverse.spring.modules.llm_providers.dtos.responses;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record LLMProviderResponse(
            UUID id,
            String key,
            String name,
            String slug,
            String description,
            String category,
            String status,
            String version,
            String website,
            String logo,
            List<String> tags,
            Map<String, Boolean> capabilities,
            boolean credentialRequired,
            Map<String, Object> configuration,
            Map<String, Object> parameters,
            Map<String, Object> credentials,
            Map<String, Object> ui,
            Map<String, Object> manifest) {
}
