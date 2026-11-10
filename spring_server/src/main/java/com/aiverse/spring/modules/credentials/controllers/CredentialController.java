package com.aiverse.spring.modules.credentials.controllers;

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

import com.aiverse.spring.modules.credentials.dtos.requests.CreateCredentialRequest;
import com.aiverse.spring.modules.credentials.dtos.requests.UpdateCredentialRequest;
import com.aiverse.spring.modules.credentials.dtos.responses.CredentialResponse;
import com.aiverse.spring.modules.credentials.services.CredentialService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/credentials")
public class CredentialController {

      public static final String USER_ID_HEADER = "X-User-Id";

      private final CredentialService credentialService;

      public CredentialController(CredentialService credentialService) {
            this.credentialService = credentialService;
      }

      @GetMapping
      public ResponseEntity<List<CredentialResponse>> getAll(@RequestHeader(USER_ID_HEADER) UUID userId) {
            return ResponseEntity.ok(credentialService.getAll(userId));
      }

      @GetMapping("/{credentialId}")
      public ResponseEntity<CredentialResponse> getById(@RequestHeader(USER_ID_HEADER) UUID userId, @PathVariable UUID credentialId) {
            return ResponseEntity.ok(credentialService.getById(userId, credentialId));
      }

      @PostMapping
      public ResponseEntity<CredentialResponse> create(@RequestHeader(USER_ID_HEADER) UUID userId,
                  @Valid @RequestBody CreateCredentialRequest request) {
            return ResponseEntity.status(HttpStatus.CREATED).body(credentialService.create(userId, request));
      }

      @PutMapping("/{credentialId}")
      public ResponseEntity<CredentialResponse> update(@RequestHeader(USER_ID_HEADER) UUID userId, @PathVariable UUID credentialId,
                  @Valid @RequestBody UpdateCredentialRequest request) {
            return ResponseEntity.ok(credentialService.update(userId, credentialId, request));
      }

      @DeleteMapping("/{credentialId}")
      public ResponseEntity<Void> delete(@RequestHeader(USER_ID_HEADER) UUID userId, @PathVariable UUID credentialId) {
            credentialService.delete(userId, credentialId);
            return ResponseEntity.noContent().build();
      }
}
