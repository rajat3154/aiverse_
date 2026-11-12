
package com.aiverse.spring.modules.llm_providers.repositories;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.aiverse.spring.modules.llm_providers.entities.LLMProviderCatalog;



public interface LLMProviderCatalogRepository  extends JpaRepository<LLMProviderCatalog, UUID> {

      Optional<LLMProviderCatalog> findByProviderKey(String providerKey);

      Optional<LLMProviderCatalog> findBySlug(String slug);

      List<LLMProviderCatalog> findByEnabledTrueOrderByNameAsc();

      boolean existsByProviderKey(String providerKey);
}
