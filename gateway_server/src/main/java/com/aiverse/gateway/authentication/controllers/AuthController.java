package com.aiverse.gateway.authentication.controllers;

import java.util.UUID;

import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.aiverse.gateway.authentication.dtos.requests.LoginRequest;
import com.aiverse.gateway.authentication.dtos.requests.RefreshTokenRequest;
import com.aiverse.gateway.authentication.dtos.responses.AuthResponse;
import com.aiverse.gateway.authentication.dtos.responses.ProfileResponse;
import com.aiverse.gateway.authentication.dtos.responses.RefreshTokenResponse;
import com.aiverse.gateway.authentication.services.AuthService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {
      private final AuthService authService;

      @GetMapping("/me")
      public ResponseEntity<ProfileResponse> me(Authentication authentication) {
            return ResponseEntity.ok(authService.profile(UUID.fromString((String) authentication.getPrincipal())));
      }

      @PostMapping("/login")
      public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
            return ResponseEntity.ok(authService.login(request));
      }

      @PostMapping("/refresh")
      public ResponseEntity<RefreshTokenResponse> refresh(@Valid @RequestBody RefreshTokenRequest request) {
            return ResponseEntity.ok(authService.refresh(request.getRefreshToken()));
      }

      @PostMapping("/logout")
      public ResponseEntity<Void> logout(@Valid @RequestBody RefreshTokenRequest request) {
            authService.logout(request.getRefreshToken());
            return ResponseEntity.noContent().build();
      }
}
