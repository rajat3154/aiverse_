package com.aiverse.spring.modules.llm_providers.controllers;

import java.util.List;
import java.util.UUID;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.aiverse.spring.modules.llm_providers.dtos.responses.LLMProviderResponse;
import com.aiverse.spring.modules.llm_providers.dtos.responses.ProviderModelResponse;
import com.aiverse.spring.modules.llm_providers.services.LLMProviderCatalogService;
import com.aiverse.spring.modules.llm_providers.services.LLMProviderModelService;

@RestController
@RequestMapping("/api/llm-providers")
public class LLMProviderController {

      public static final String USER_ID_HEADER = "X-User-Id";

      private final LLMProviderCatalogService catalogService;
      private final LLMProviderModelService modelService;

      public LLMProviderController(LLMProviderCatalogService catalogService, LLMProviderModelService modelService) {
            this.catalogService = catalogService;
            this.modelService = modelService;
      }

      @GetMapping
      public ResponseEntity<List<LLMProviderResponse>> getAll() {
            return ResponseEntity.ok(catalogService.getEnabledProviders());
      }

      @GetMapping("/{id}/models")
      public ResponseEntity<List<ProviderModelResponse>> getModels(@RequestHeader(USER_ID_HEADER) UUID userId, @PathVariable UUID id,
                  @RequestParam UUID credentialId) {
            return ResponseEntity.ok(modelService.listModels(userId, id, credentialId));
      }

      @PutMapping(value = "/{id}/logo", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
      public ResponseEntity<LLMProviderResponse> uploadLogo(@PathVariable UUID id, @RequestPart("file") MultipartFile file) {
            return ResponseEntity.ok(catalogService.updateLogo(id, file));
      }

      @DeleteMapping("/{id}/logo")
      public ResponseEntity<LLMProviderResponse> removeLogo(@PathVariable UUID id) {
            return ResponseEntity.ok(catalogService.removeLogo(id));
      }
}
