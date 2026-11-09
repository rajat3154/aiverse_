package com.aiverse.gateway.authentication.dtos.responses;

import java.util.UUID;

public record AuthUserResponse(UUID tenantId,String email,String username,String role) {
      
}
