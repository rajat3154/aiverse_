package com.aiverse.gateway.authentication.services;

import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Service;

import com.aiverse.gateway.authentication.dtos.responses.AuthResponse;
import com.aiverse.gateway.authentication.dtos.responses.AuthUserResponse;
import com.aiverse.gateway.authentication.dtos.responses.OAuthCodeExchangeResponse;
import com.aiverse.gateway.authentication.entity.User;
import com.aiverse.gateway.authentication.exceptions.InvalidCredentialsException;


@Service
public class OAuthTokenExchangeService {

      private static final Logger log = LoggerFactory.getLogger(OAuthTokenExchangeService.class);
      private final OAuthAuthorizationCodeService authorizationCodeService;
      private final AuthService authService;
      private final MessageSource messages;

      public OAuthTokenExchangeService( OAuthAuthorizationCodeService authorizationCodeService, AuthService authService, MessageSource messages) {
            this.authorizationCodeService = authorizationCodeService;
            this.authService = authService;
            this.messages = messages;
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      public OAuthCodeExchangeResponse exchange(String code) {
            long startedAt = System.currentTimeMillis();
            log.info(message("oauth.exchange.started"));
            User user = authorizationCodeService.consumeCode(code);
            if (!user.isEnabled()) {
                  log.warn(message("oauth.exchange.disabled", user.getTenantId()));
                  throw new InvalidCredentialsException(message("oauth.exchange.account.disabled"));
            }
            AuthResponse tokens = authService.issueTokens(user);
            log.info(message("oauth.exchange.completed", user.getTenantId(), System.currentTimeMillis() - startedAt));
            return new OAuthCodeExchangeResponse(
                        tokens.getAccessToken(),
                        tokens.getRefreshToken(),
                        tokens.getTokenType(),
                        tokens.getExpiresIn(),
                        new AuthUserResponse(user.getTenantId(), user.getEmail(), user.getUsername(), user.getRole()));
      }
}
