
package com.aiverse.gateway.authentication.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User {
      @Id
      @Column(name = "tenant_id", nullable = false)
      private UUID tenantId;

      @Column(name = "api_key", nullable = false, length = 500)
      private String apiKey;

      @Column(name = "email")
      private String email;

      @Column(name = "username")
      private String username;

      @Column(name = "password")
      private String password;

      @Column(name = "role")
      private String role;

      @Column(name = "enabled")
      private boolean enabled;

      @Column(name = "email_verified")
      private boolean emailVerified;
}
