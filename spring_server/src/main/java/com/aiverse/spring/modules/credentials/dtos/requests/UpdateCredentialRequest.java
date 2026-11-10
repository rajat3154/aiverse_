package com.aiverse.spring.modules.credentials.dtos.requests;

import java.util.Map;

import com.aiverse.spring.modules.credentials.enums.CredentialIdentifier;
import com.aiverse.spring.modules.credentials.enums.CredentialStatus;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateCredentialRequest(
            @NotBlank(message = "Name is required") @Size(max = 150, message = "Name must not exceed 150 characters") String name,
            @Size(max = 100, message = "Provider must not exceed 100 characters") String provider,
            CredentialIdentifier identifier,
            @Size(max = 8192, message = "Secret must not exceed 8192 characters") String secret,
            @Size(max = 30, message = "Metadata can hold at most 30 entries") Map<String, Object> metadata,
            CredentialStatus status) {
}
