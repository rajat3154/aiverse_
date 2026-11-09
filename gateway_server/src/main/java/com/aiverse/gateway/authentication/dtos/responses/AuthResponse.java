
package com.aiverse.gateway.authentication.dtos.responses;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@AllArgsConstructor
public class AuthResponse {
      private String accessToken;
      private String refreshToken;
      private String tokenType;
      private long expiresIn;
      private UUID tenantId;
      private String email;
      private String username;
      private String role;
}
