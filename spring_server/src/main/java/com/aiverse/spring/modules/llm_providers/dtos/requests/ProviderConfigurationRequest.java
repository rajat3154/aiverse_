package com.aiverse.spring.modules.llm_providers.dtos.requests;

import java.util.Map;
import java.util.UUID;

public record ProviderConfigurationRequest(
            String name,
            UUID credentialId,
            String model,
            Map<String, Object> configuration,
            Map<String, Object> parameters,
            Boolean active) {
}
