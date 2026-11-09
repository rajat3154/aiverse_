package com.aiverse.gateway.authentication.entity;

import com.aiverse.gateway.authentication.enums.AuthProvider;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "user_auth_providers", uniqueConstraints = {
            @UniqueConstraint(name = "uk_auth_provider_user", columnNames = { "user_id", "provider" }),
            @UniqueConstraint(name = "uk_auth_provider_external_id", columnNames = { "provider", "provider_user_id" })
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class UserAuthProvider {
      @Id
      @GeneratedValue(strategy = GenerationType.UUID)
      private UUID id;

      @ManyToOne(fetch = FetchType.LAZY, optional = false)
      @JoinColumn(name = "user_id", referencedColumnName = "tenant_id", nullable = false)
      private User user;

      @Enumerated(EnumType.STRING)
      @Column(nullable = false, length = 30)
      private AuthProvider provider;

      @Column(name = "provider_user_id", nullable = false, length = 255)
      private String providerUserId;

      @Column(name = "provider_email", length = 255)
      private String providerEmail;

      @Column(name = "created_at", nullable = false, updatable = false)
      private Instant createdAt;

      @Column(name = "updated_at", nullable = false)
      private Instant updatedAt;

      @PrePersist
      protected void onCreate() {
            Instant now = Instant.now();
            createdAt = now;
            updatedAt = now;
      }

      @PreUpdate
      protected void onUpdate() {
            updatedAt = Instant.now();
      }

      public static UserAuthProvider create(User user, AuthProvider provider, String providerUserId,
                  String providerEmail) {
            UserAuthProvider mapping = new UserAuthProvider();
            mapping.user = user;
            mapping.provider = provider;
            mapping.providerUserId = providerUserId;
            mapping.providerEmail = providerEmail;
            return mapping;
      }
}