package com.aiverse.spring.modules.credentials.dtos.requests;

import java.util.Map;

import com.aiverse.spring.modules.credentials.enums.CredentialIdentifier;
import com.aiverse.spring.modules.credentials.enums.CredentialType;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateCredentialRequest(
            @NotBlank(message = "Name is required") @Size(max = 150, message = "Name must not exceed 150 characters") String name,
            @NotNull(message = "Type is required") CredentialType type,
            @Size(max = 100, message = "Provider must not exceed 100 characters") String provider,
            CredentialIdentifier identifier,
            @NotBlank(message = "Secret is required") @Size(max = 8192, message = "Secret must not exceed 8192 characters") String secret,
            @Size(max = 30, message = "Metadata can hold at most 30 entries") Map<String, Object> metadata) {
}
