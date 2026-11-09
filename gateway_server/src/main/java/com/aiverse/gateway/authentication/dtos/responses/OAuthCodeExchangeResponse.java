package com.aiverse.gateway.authentication.dtos.responses;

public record OAuthCodeExchangeResponse(
            String accessToken,
            String refreshToken,
            String tokenType,
            long expiresIn,
            AuthUserResponse user) {
}
