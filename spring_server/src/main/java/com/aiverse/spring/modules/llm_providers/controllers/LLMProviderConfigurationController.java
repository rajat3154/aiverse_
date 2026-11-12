package com.aiverse.spring.modules.llm_providers.controllers;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.aiverse.spring.modules.llm_providers.dtos.requests.ProviderChatRequest;
import com.aiverse.spring.modules.llm_providers.dtos.requests.ProviderConfigurationRequest;
import com.aiverse.spring.modules.llm_providers.dtos.responses.ProviderChatResponse;
import com.aiverse.spring.modules.llm_providers.dtos.responses.ProviderConfigurationResponse;
import com.aiverse.spring.modules.llm_providers.services.LLMProviderConfigurationService;


@RestController
@RequestMapping("/api/llm-providers/{providerId}/configurations")
public class LLMProviderConfigurationController {

      private static final String USER_ID_HEADER = LLMProviderController.USER_ID_HEADER;

      private final LLMProviderConfigurationService service;

      public LLMProviderConfigurationController(LLMProviderConfigurationService service) {
            this.service = service;
      }

      @GetMapping
      public ResponseEntity<List<ProviderConfigurationResponse>> list(@RequestHeader(USER_ID_HEADER) UUID userId, @PathVariable UUID providerId) {
            return ResponseEntity.ok(service.list(userId, providerId));
      }

      @PostMapping
      public ResponseEntity<ProviderConfigurationResponse> create(@RequestHeader(USER_ID_HEADER) UUID userId, @PathVariable UUID providerId,
                  @RequestBody ProviderConfigurationRequest request) {
            return ResponseEntity.status(HttpStatus.CREATED).body(service.create(userId, providerId, request));
      }

      @PutMapping("/{id}")
      public ResponseEntity<ProviderConfigurationResponse> update(@RequestHeader(USER_ID_HEADER) UUID userId, @PathVariable UUID providerId,
                  @PathVariable UUID id, @RequestBody ProviderConfigurationRequest request) {
            return ResponseEntity.ok(service.update(userId, providerId, id, request));
      }

      @PostMapping("/{id}/activate")
      public ResponseEntity<ProviderConfigurationResponse> activate(@RequestHeader(USER_ID_HEADER) UUID userId, @PathVariable UUID providerId,
                  @PathVariable UUID id) {
            return ResponseEntity.ok(service.activate(userId, providerId, id));
      }

      @DeleteMapping("/{id}")
      public ResponseEntity<Void> delete(@RequestHeader(USER_ID_HEADER) UUID userId, @PathVariable UUID providerId, @PathVariable UUID id) {
            service.delete(userId, providerId, id);
            return ResponseEntity.noContent().build();
      }

      @PostMapping("/{id}/chat")
      public ResponseEntity<ProviderChatResponse> chat(@RequestHeader(USER_ID_HEADER) UUID userId, @PathVariable UUID providerId, @PathVariable UUID id,
                  @RequestBody ProviderChatRequest request) {
            return ResponseEntity.ok(service.chat(userId, providerId, id, request));
      }
}
