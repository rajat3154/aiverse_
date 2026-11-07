package com.aiverse.spring.modules.authentication.master.dtos;

import java.time.Instant;
import java.util.UUID;

import com.aiverse.spring.modules.authentication.users.enums.Role;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
public class MasterResponse {
      private UUID tenantId;
      private String apiKey;
      private String firstName;
      private String lastName;
      private String username;
      private String email;
      private Role role;
      private boolean enabled;
      private boolean emailVerified;
      private Instant createdAt;
      private Instant updatedAt;
}
