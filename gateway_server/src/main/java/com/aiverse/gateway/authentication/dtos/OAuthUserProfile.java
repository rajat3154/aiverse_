package com.aiverse.gateway.authentication.dtos;

public record OAuthUserProfile(
            String providerUserId,
            String email,
            boolean emailVerified,
            String firstName,
            String lastName,
            String profilePhoto) {
}