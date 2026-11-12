package com.aiverse.spring.modules.llm_providers.services;

import java.io.IOException;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.aiverse.spring.modules.llm_providers.dtos.responses.LLMProviderResponse;
import com.aiverse.spring.modules.llm_providers.entities.LLMProviderCatalog;
import com.aiverse.spring.modules.llm_providers.exceptions.LLMProviderException;
import com.aiverse.spring.modules.llm_providers.repositories.LLMProviderCatalogRepository;


@Service
public class LLMProviderCatalogService {

      private static final long MAX_LOGO_BYTES = 256 * 1024;
      private static final Set<String> ALLOWED_LOGO_TYPES = Set.of("image/png", "image/jpeg", "image/webp", "image/svg+xml");

      private final LLMProviderCatalogRepository repository;

      public LLMProviderCatalogService(LLMProviderCatalogRepository repository) {
            this.repository = repository;
      }

      @Transactional(readOnly = true)
      public List<LLMProviderResponse> getEnabledProviders() {
            return repository.findByEnabledTrueOrderByNameAsc().stream().map(this::toResponse).toList();
      }

      @Transactional
      public LLMProviderResponse updateLogo(UUID id, MultipartFile file) {
            if (file == null || file.isEmpty()) {
                  throw new LLMProviderException(HttpStatus.BAD_REQUEST, "Choose an image to upload.");
            }
            if (file.getSize() > MAX_LOGO_BYTES) {
                  throw new LLMProviderException(HttpStatus.PAYLOAD_TOO_LARGE, "The logo must be 256 KB or smaller.");
            }
            String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
            if (!ALLOWED_LOGO_TYPES.contains(contentType)) {
                  throw new LLMProviderException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "The logo must be a PNG, JPEG, WebP or SVG image.");
            }
            LLMProviderCatalog entity = find(id);
            try {
                  entity.setLogo("data:" + contentType + ";base64," + Base64.getEncoder().encodeToString(file.getBytes()));
            } catch (IOException exception) {
                  throw new LLMProviderException(HttpStatus.BAD_REQUEST, "The logo could not be read.");
            }
            return toResponse(repository.save(entity));
      }

      @Transactional
      public LLMProviderResponse removeLogo(UUID id) {
            LLMProviderCatalog entity = find(id);
            entity.setLogo(null);
            return toResponse(repository.save(entity));
      }

      private LLMProviderCatalog find(UUID id) {
            return repository.findById(id).orElseThrow(() -> new LLMProviderException(HttpStatus.NOT_FOUND, "Provider not found."));
      }

      private LLMProviderResponse toResponse(LLMProviderCatalog entity) {
            Map<String, Object> manifest = entity.getManifest() == null ? Map.of() : entity.getManifest();
            Map<String, Object> provider = asMap(manifest.get("provider"));
            Map<String, Object> credentials = asMap(manifest.get("credentials"));

            Map<String, Boolean> capabilities = new LinkedHashMap<>();
            asMap(manifest.get("capabilities")).forEach((name, value) -> {
                  if (value instanceof Boolean flag) {
                        capabilities.put(name, flag);
                  }
            });

            List<String> tags = provider.get("tags") instanceof List<?> list ? list.stream().filter(String.class::isInstance).map(String.class::cast).toList() : List.of();

            return new LLMProviderResponse(
                        entity.getId(),
                        entity.getProviderKey(),
                        entity.getName(),
                        entity.getSlug(),
                        entity.getDescription(),
                        entity.getCategory(),
                        entity.getStatus(),
                        entity.getManifestVersion(),
                        provider.get("website") instanceof String website ? website : null,
                        entity.getLogo() != null ? entity.getLogo() : provider.get("logo") instanceof String logo ? logo : null,
                        tags,
                        capabilities,
                        !Boolean.FALSE.equals(credentials.get("required")),
                        asMap(manifest.get("configuration")),
                        asMap(manifest.get("parameters")),
                        credentials,
                        asMap(manifest.get("ui")),
                        manifest);
      }

      @SuppressWarnings("unchecked")
      private static Map<String, Object> asMap(Object value) {
            return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
      }
}
