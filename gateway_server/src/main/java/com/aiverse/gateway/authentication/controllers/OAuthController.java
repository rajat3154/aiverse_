package com.aiverse.gateway.authentication.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.aiverse.gateway.authentication.dtos.requests.OAuthCodeExchangeRequest;
import com.aiverse.gateway.authentication.dtos.responses.OAuthCodeExchangeResponse;
import com.aiverse.gateway.authentication.services.OAuthTokenExchangeService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/v1/auth/oauth")
@RequiredArgsConstructor
public class OAuthController {
      private final OAuthTokenExchangeService tokenExchangeService;
      @PostMapping("/exchange")
      public ResponseEntity<OAuthCodeExchangeResponse> exchange(@Valid @RequestBody OAuthCodeExchangeRequest request) {
            return ResponseEntity.ok(tokenExchangeService.exchange(request.code()));
      }
}
