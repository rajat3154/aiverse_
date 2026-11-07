package com.aiverse.spring.modules.authentication.users.controllers;

import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.aiverse.spring.modules.authentication.users.dtos.requests.SignupRequest;
import com.aiverse.spring.modules.authentication.users.dtos.responses.SignupResponse;
import com.aiverse.spring.modules.authentication.users.services.AuthenticationService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class AuthenticationController {

      private static final Logger log = LoggerFactory.getLogger(AuthenticationController.class);

      private final AuthenticationService authenticationService;
      private final MessageSource messages;

      public AuthenticationController(AuthenticationService authenticationService, MessageSource messages) {
            this.authenticationService = authenticationService;
            this.messages = messages;
      }

      @PostMapping("/signup")
      public ResponseEntity<SignupResponse> signup(@Valid @RequestBody SignupRequest request) {
            log.info(messages.getMessage("auth.signup.request", new Object[] { request.getEmail(), request.getUsername() },
                        Locale.getDefault()));
            SignupResponse response = authenticationService.signup(request);
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
      }
}
