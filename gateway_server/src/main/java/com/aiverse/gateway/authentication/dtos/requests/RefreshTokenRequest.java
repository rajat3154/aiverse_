package com.aiverse.gateway.authentication.dtos.requests;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class RefreshTokenRequest {
      @NotBlank(message = "{auth.validation.refresh-token.required}")
      private String refreshToken;
}
