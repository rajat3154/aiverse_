package com.aiverse.gateway.authentication.services;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.aiverse.gateway.authentication.entity.OAuthAuthorizationCode;
import com.aiverse.gateway.authentication.entity.User;
import com.aiverse.gateway.authentication.exceptions.InvalidTokenException;
import com.aiverse.gateway.authentication.repositories.OAuthAuthorizationCodeRepository;

@Service
public class OAuthAuthorizationCodeService {

      private static final Logger log = LoggerFactory.getLogger(OAuthAuthorizationCodeService.class);
      private static final long CODE_VALIDITY_SECONDS = 60;
      private static final int CODE_BYTES = 32;

      private final OAuthAuthorizationCodeRepository repository;
      private final MessageSource messages;
      private final SecureRandom secureRandom = new SecureRandom();

      public OAuthAuthorizationCodeService(OAuthAuthorizationCodeRepository repository, MessageSource messages) {
            this.repository = repository;
            this.messages = messages;
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      @Transactional
      public String createCode(User user) {
            byte[] bytes = new byte[CODE_BYTES];
            secureRandom.nextBytes(bytes);
            String code = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
            repository.save(OAuthAuthorizationCode.create(code, user, Instant.now().plusSeconds(CODE_VALIDITY_SECONDS)));
            log.info(message("oauth.code.created", user.getTenantId(), CODE_VALIDITY_SECONDS));
            return code;
      }

      @Transactional
      public User consumeCode(String code) {
            if (code == null || code.isBlank()) {
                  throw new InvalidTokenException(message("oauth.code.required"));
            }
            OAuthAuthorizationCode authorizationCode = repository.findByCodeForUpdate(code).orElseThrow(() -> {
                              log.warn(message("oauth.code.unknown"));
                              return new InvalidTokenException(message("oauth.code.invalid"));
                        });

            if (authorizationCode.isUsed() || authorizationCode.isExpired()) {
                  log.warn(message("oauth.code.rejected", authorizationCode.getUser().getTenantId(),authorizationCode.isUsed() ? "already used" : "expired"));
                  throw new InvalidTokenException(message("oauth.code.invalid"));
            }
            authorizationCode.markAsUsed();
            log.info(message("oauth.code.consumed", authorizationCode.getUser().getTenantId()));
            return authorizationCode.getUser();
      }
}
