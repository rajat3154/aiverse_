
package com.aiverse.gateway.authentication.entity;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "oauth_authorization_codes", indexes = {
            @Index(name = "idx_oauth_code_value", columnList = "code", unique = true)
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OAuthAuthorizationCode {
      @Id
      @GeneratedValue(strategy = GenerationType.UUID)
      private UUID id;

      @Column(nullable = false, unique = true, length = 512)
      private String code;

      @ManyToOne(fetch = FetchType.LAZY, optional = false)
      @JoinColumn(name = "user_id", referencedColumnName = "tenant_id", nullable = false, foreignKey = @ForeignKey(name = "fk_oauth_code_user"))
      private User user;

      @Column(name = "expires_at", nullable = false)
      private Instant expiresAt;

      @Column(nullable = false)
      private boolean used = false;

      @Column(name = "created_at", nullable = false, updatable = false)
      private Instant createdAt;

      @PrePersist
      protected void onCreate() {
            if (createdAt == null) {
                  createdAt = Instant.now();
            }
      }

      public static OAuthAuthorizationCode create(
                  String code,
                  User user,
                  Instant expiresAt) {
            OAuthAuthorizationCode authorizationCode = new OAuthAuthorizationCode();
            authorizationCode.code = code;
            authorizationCode.user = user;
            authorizationCode.expiresAt = expiresAt;
            authorizationCode.used = false;
            return authorizationCode;
      }

      public boolean isExpired() {
            return !Instant.now().isBefore(expiresAt);
      }

      public void markAsUsed() {
            this.used = true;
      }
}
