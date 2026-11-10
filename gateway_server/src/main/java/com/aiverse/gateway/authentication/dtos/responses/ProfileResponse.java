package com.aiverse.gateway.authentication.dtos.responses;

import java.util.UUID;


public record ProfileResponse(UUID tenantId, String firstName, String lastName, String email, String username,
            String role, String profilePhoto) {
}
