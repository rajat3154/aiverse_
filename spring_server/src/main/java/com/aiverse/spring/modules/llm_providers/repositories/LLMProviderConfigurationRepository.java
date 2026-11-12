package com.aiverse.spring.modules.llm_providers.repositories;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.aiverse.spring.modules.llm_providers.entities.LLMProviderConfiguration;

public interface LLMProviderConfigurationRepository extends JpaRepository<LLMProviderConfiguration, UUID> {

      List<LLMProviderConfiguration> findAllByUserIdAndProviderIdOrderByCreatedAtAsc(UUID userId, UUID providerId);

      Optional<LLMProviderConfiguration> findByIdAndUserIdAndProviderId(UUID id, UUID userId, UUID providerId);

      Optional<LLMProviderConfiguration> findByUserIdAndProviderIdAndActiveTrue(UUID userId, UUID providerId);

      boolean existsByUserIdAndProviderIdAndNameIgnoreCase(UUID userId, UUID providerId, String name);

      boolean existsByUserIdAndProviderIdAndNameIgnoreCaseAndIdNot(UUID userId, UUID providerId, String name, UUID id);

      long countByUserIdAndProviderId(UUID userId, UUID providerId);
}
