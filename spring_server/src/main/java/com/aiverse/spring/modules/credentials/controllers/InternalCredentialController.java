package com.aiverse.spring.modules.credentials.controllers;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.aiverse.spring.modules.credentials.services.CredentialService;


@RestController
@RequestMapping("/internal/credentials")
public class InternalCredentialController {

      private final CredentialService credentialService;
      private final String internalToken;

      public InternalCredentialController(CredentialService credentialService, @Value("${aiverse.ai.internal-token:}") String internalToken) {
            this.credentialService = credentialService;
            this.internalToken = internalToken;
      }

      @GetMapping("/{credentialId}/secret")
      public ResponseEntity<Map<String, String>> secret(@RequestHeader(value = "X-Internal-Token", required = false) String token, @RequestHeader("X-User-Id") UUID userId, @PathVariable UUID credentialId) {
            if (internalToken == null || internalToken.isBlank() || token == null || !MessageDigest.isEqual(token.getBytes(StandardCharsets.UTF_8), internalToken.getBytes(StandardCharsets.UTF_8))) {
                  return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }
            return ResponseEntity.ok(Map.of("secret", credentialService.getSecret(userId, credentialId)));
      }
}
