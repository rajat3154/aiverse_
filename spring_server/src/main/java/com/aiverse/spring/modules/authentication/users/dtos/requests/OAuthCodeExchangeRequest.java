package com.aiverse.spring.modules.authentication.users.dtos.requests;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OAuthCodeExchangeRequest {
      @NotBlank(message = "OAuth authorization code is required")
      private String code;
}