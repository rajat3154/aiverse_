package com.aiverse.spring.modules.authentication.master.controllers;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.aiverse.spring.modules.authentication.master.dtos.CreateMasterRequest;
import com.aiverse.spring.modules.authentication.master.dtos.MasterResponse;
import com.aiverse.spring.modules.authentication.master.exceptions.MasterAccessDeniedException;
import com.aiverse.spring.modules.authentication.master.services.MasterService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/master")
public class MasterController {

      private static final Logger log = LoggerFactory.getLogger(MasterController.class);

      private final MasterService masterService;
      private final MessageSource messages;
      private final String bootstrapToken;

      public MasterController(MasterService masterService, MessageSource messages,
                  @Value("${aiverse.master.bootstrap-token:}") String bootstrapToken) {
            this.masterService = masterService;
            this.messages = messages;
            this.bootstrapToken = bootstrapToken;
      }

      @PostMapping
      public ResponseEntity<MasterResponse> createMaster(
                  @RequestHeader(value = "X-Master-Token", required = false) String token,
                  @Valid @RequestBody CreateMasterRequest request) {
            requireBootstrapToken(token);
            log.info(messages.getMessage("master.create.request", new Object[] { request.getEmail(), request.getUsername() },
                        Locale.getDefault()));
            MasterResponse response = masterService.createMaster(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
      }

      /** The endpoint is closed unless a bootstrap token is configured and the caller sends the same one. */
      private void requireBootstrapToken(String token) {
            if (bootstrapToken.isBlank()) {
                  throw new MasterAccessDeniedException(messages.getMessage("master.token.disabled", null, Locale.getDefault()));
            }
            boolean matches = token != null && MessageDigest.isEqual(token.getBytes(StandardCharsets.UTF_8),
                        bootstrapToken.getBytes(StandardCharsets.UTF_8));
            if (!matches) {
                  throw new MasterAccessDeniedException(messages.getMessage("master.token.invalid", null, Locale.getDefault()));
            }
      }
}
