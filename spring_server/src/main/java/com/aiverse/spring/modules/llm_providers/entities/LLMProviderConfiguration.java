package com.aiverse.spring.modules.llm_providers.entities;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;


@Entity
@Table(name = "llm_provider_configurations")
@Getter
@Setter
@NoArgsConstructor
public class LLMProviderConfiguration {

      @Id
      @GeneratedValue(strategy = GenerationType.UUID)
      private UUID id;

      @Column(name = "user_id", nullable = false)
      private UUID userId;

      @Column(name = "provider_id", nullable = false)
      private UUID providerId;

      @Column(nullable = false, length = 150)
      private String name;

      @Column(name = "credential_id")
      private UUID credentialId;

      @Column(length = 255)
      private String model;

      @JdbcTypeCode(SqlTypes.JSON)
      @Column(columnDefinition = "jsonb")
      private Map<String, Object> configuration;

      @JdbcTypeCode(SqlTypes.JSON)
      @Column(columnDefinition = "jsonb")
      private Map<String, Object> parameters;

      @Column(nullable = false)
      private boolean active;

      @Column(name = "created_at", nullable = false, updatable = false)
      private Instant createdAt;

      @Column(name = "updated_at", nullable = false)
      private Instant updatedAt;

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
