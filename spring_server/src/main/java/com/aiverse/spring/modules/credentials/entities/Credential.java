package com.aiverse.spring.modules.credentials.entities;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import com.aiverse.spring.modules.credentials.enums.CredentialIdentifier;
import com.aiverse.spring.modules.credentials.enums.CredentialStatus;
import com.aiverse.spring.modules.credentials.enums.CredentialStorageType;
import com.aiverse.spring.modules.credentials.enums.CredentialType;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "credentials", uniqueConstraints = {@UniqueConstraint(name = "uk_credentials_user_name", columnNames = { "user_id", "name" }) })
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Credential {

      @Id
      @GeneratedValue(strategy = GenerationType.UUID)
      private UUID id;

      @Column(name = "user_id", nullable = false)
      private UUID userId;

      @Column(nullable = false, length = 150)
      private String name;

      @Enumerated(EnumType.STRING)
      @Column(nullable = false, length = 50)
      private CredentialType type;

      @Column(length = 100)
      private String provider;

      @Enumerated(EnumType.STRING)
      @Column(length = 50)
      private CredentialIdentifier identifier;

      /** AES-GCM ciphertext (base64). The plain secret is never stored and never returned by the API. */
      @Column(name = "secret", nullable = false, columnDefinition = "TEXT")
      private String secret;

      @Enumerated(EnumType.STRING)
      @Column(name = "storage_type", nullable = false, length = 20)
      private CredentialStorageType storageType;

      @JdbcTypeCode(SqlTypes.JSON)
      @Column(columnDefinition = "jsonb")
      private Map<String, Object> metadata;

      @Enumerated(EnumType.STRING)
      @Column(nullable = false, length = 20)
      @Builder.Default
      private CredentialStatus status = CredentialStatus.ACTIVE;

      @Column(name = "created_at", nullable = false, updatable = false)
      private Instant createdAt;

      @Column(name = "updated_at", nullable = false)
      private Instant updatedAt;

      @Column(name = "last_used_at")
      private Instant lastUsedAt;

      @PrePersist
      protected void onCreate() {
            Instant now = Instant.now();
            if (createdAt == null) createdAt = now;
            if (updatedAt == null) updatedAt = now;
      }

      @PreUpdate
      protected void onUpdate() {
            updatedAt = Instant.now();
      }
}
