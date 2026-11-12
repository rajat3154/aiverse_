package com.aiverse.spring.modules.llm_providers.dtos.responses;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

public record ProviderConfigurationResponse(
            UUID id,
            UUID providerId,
            String name,
            UUID credentialId,
            String model,
            Map<String, Object> configuration,
            Map<String, Object> parameters,
            boolean active,
            Instant createdAt,
            Instant updatedAt) {
}
