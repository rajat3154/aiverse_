package com.aiverse.gateway.authentication.dtos.requests;

import jakarta.validation.constraints.NotBlank;

public record OAuthCodeExchangeRequest(@NotBlank(message = "{oauth.code.required}") String code) {
      
}
