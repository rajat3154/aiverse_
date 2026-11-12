
package com.aiverse.spring.modules.llm_providers.entities;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "llm_provider_catalog")
@Getter
@Setter
@NoArgsConstructor
public class LLMProviderCatalog {

      @Id
      @GeneratedValue
      @UuidGenerator
      private UUID id;

      @Column(name = "provider_key", nullable = false, unique = true, length = 100)
      private String providerKey;

      @Column(nullable = false, length = 255)
      private String name;

      @Column(nullable = false, unique = true, length = 100)
      private String slug;

      @Column(columnDefinition = "TEXT")
      private String description;

      @Column(nullable = false, length = 50)
      private String category;

      @Column(nullable = false, length = 30)
      private String status;

      @Column(name = "manifest_version", nullable = false, length = 30)
      private String manifestVersion;

      @Column(name = "manifest_hash", nullable = false, length = 64)
      private String manifestHash;

      @JdbcTypeCode(SqlTypes.JSON)
      @Column(nullable = false, columnDefinition = "jsonb")
      private Map<String, Object> manifest;

      @Column(nullable = false)
      private boolean enabled = true;

      @Column(columnDefinition = "TEXT")
      private String logo;

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
}
