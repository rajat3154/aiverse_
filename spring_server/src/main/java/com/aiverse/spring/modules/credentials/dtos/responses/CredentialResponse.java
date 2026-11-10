package com.aiverse.spring.modules.credentials.dtos.responses;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import com.aiverse.spring.modules.credentials.enums.CredentialIdentifier;
import com.aiverse.spring.modules.credentials.enums.CredentialStatus;
import com.aiverse.spring.modules.credentials.enums.CredentialStorageType;
import com.aiverse.spring.modules.credentials.enums.CredentialType;


public record CredentialResponse(
            UUID id,
            String name,
            CredentialType type,
            String provider,
            CredentialIdentifier identifier,
            CredentialStorageType storageType,
            Map<String, Object> metadata,
            CredentialStatus status,
            Instant createdAt,
            Instant updatedAt,
            Instant lastUsedAt) {
                  
}
