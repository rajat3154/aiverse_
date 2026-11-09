package com.aiverse.gateway.authentication.dtos.requests;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class LoginRequest {
      @NotBlank(message = "{auth.validation.identifier.required}")
      private String identifier;

      @NotBlank(message = "{auth.validation.password.required}")
      private String password;
}
