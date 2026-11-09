package com.aiverse.gateway.authentication.services;

import java.util.Locale;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.aiverse.gateway.authentication.dtos.requests.LoginRequest;
import com.aiverse.gateway.authentication.dtos.responses.AuthResponse;
import com.aiverse.gateway.authentication.dtos.responses.RefreshTokenResponse;
import com.aiverse.gateway.authentication.entity.User;
import com.aiverse.gateway.authentication.exceptions.InvalidCredentialsException;
import com.aiverse.gateway.authentication.exceptions.InvalidTokenException;
import com.aiverse.gateway.authentication.repositories.UserRepository;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;

@Service
public class AuthService {

      private static final Logger log = LoggerFactory.getLogger(AuthService.class);

      private final UserRepository userRepository;
      private final PasswordEncoder passwordEncoder;
      private final JwtService jwtService;
      private final RefreshTokenStore refreshTokenStore;
      private final MessageSource messages;

      public AuthService(
                  UserRepository userRepository,
                  PasswordEncoder passwordEncoder,
                  JwtService jwtService,
                  RefreshTokenStore refreshTokenStore,
                  MessageSource messages) {
            this.userRepository = userRepository;
            this.passwordEncoder = passwordEncoder;
            this.jwtService = jwtService;
            this.refreshTokenStore = refreshTokenStore;
            this.messages = messages;
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      @Transactional(readOnly = true)
      public AuthResponse login(LoginRequest request) {
            long startedAt = System.currentTimeMillis();
            String identifier = request.getIdentifier().trim();
            log.info(message("auth.login.started", identifier));
            try {
                  User user = findUser(identifier);
                  if (!user.isEnabled() || !passwordEncoder.matches(request.getPassword(), user.getPassword())) {
                        throw new InvalidCredentialsException(message("auth.login.invalid"));
                  }
                  UUID userId = user.getTenantId();
                  String accessToken = jwtService.generateAccessToken(userId, user.getEmail(), user.getUsername(), user.getRole());
                  String refreshToken = jwtService.generateRefreshToken(userId);
                  Claims refreshClaims = jwtService.validateRefreshToken(refreshToken);
                  refreshTokenStore.register(userId, jwtService.getTokenId(refreshClaims));
                  log.info(message("auth.login.completed", userId, System.currentTimeMillis() - startedAt));
                  return AuthResponse.builder()
                              .accessToken(accessToken)
                              .refreshToken(refreshToken)
                              .tokenType("Bearer")
                              .expiresIn(jwtService.getAccessTokenExpiration() / 1000)
                              .tenantId(userId)
                              .email(user.getEmail())
                              .username(user.getUsername())
                              .role(user.getRole())
                              .build();
            } catch (InvalidCredentialsException exception) {
                  log.warn(message("auth.login.failed", identifier, exception.getMessage(),
                              System.currentTimeMillis() - startedAt));
                  throw exception;
            } catch (RuntimeException exception) {
                  log.error(message("auth.login.failed", identifier, exception.getMessage(),
                              System.currentTimeMillis() - startedAt), exception);
                  throw exception;
            }
      }

      @Transactional
      public RefreshTokenResponse refresh(String refreshToken) {
            long startedAt = System.currentTimeMillis();
            log.info(message("auth.refresh.started"));
            try {
                  Claims claims = validateRefreshToken(refreshToken);
                  UUID userId = jwtService.getUserId(claims);
                  String tokenId = jwtService.getTokenId(claims);
                  User user = userRepository.findById(userId).filter(User::isEnabled).orElseThrow(() -> new InvalidTokenException(message("auth.token.refresh.invalid")));
                  if (!refreshTokenStore.consume(userId, tokenId)) {
                        throw new InvalidTokenException(message("auth.token.refresh.revoked"));
                  }
                  String accessToken = jwtService.generateAccessToken( userId, user.getEmail(), user.getUsername(), user.getRole());
                  String newRefreshToken = jwtService.generateRefreshToken(userId);
                  Claims newClaims = jwtService.validateRefreshToken(newRefreshToken);
                  refreshTokenStore.register(userId, jwtService.getTokenId(newClaims));
                  log.info(message("auth.refresh.completed", userId, System.currentTimeMillis() - startedAt));
                  return RefreshTokenResponse.builder()
                              .accessToken(accessToken)
                              .refreshToken(newRefreshToken)
                              .tokenType("Bearer")
                              .expiresIn(jwtService.getAccessTokenExpiration() / 1000)
                              .build();
            } catch (InvalidTokenException exception) {
                  log.warn(message("auth.refresh.failed", exception.getMessage(), System.currentTimeMillis() - startedAt));
                  throw exception;
            } catch (RuntimeException exception) {
                  log.error(message("auth.refresh.failed", exception.getMessage(), System.currentTimeMillis() - startedAt),exception);
                  throw exception;
            }
      }

      public void logout(String refreshToken) {
            long startedAt = System.currentTimeMillis();
            log.info(message("auth.logout.started"));
            try {
                  Claims claims = validateRefreshToken(refreshToken);
                  UUID userId = jwtService.getUserId(claims);
                  if (!refreshTokenStore.consume(userId, jwtService.getTokenId(claims))) {
                        throw new InvalidTokenException(message("auth.token.refresh.revoked"));
                  }
                  log.info(message("auth.logout.completed", userId, System.currentTimeMillis() - startedAt));
            } catch (InvalidTokenException exception) {
                  log.warn(message("auth.logout.failed", exception.getMessage(), System.currentTimeMillis() - startedAt));
                  throw exception;
            } catch (RuntimeException exception) {
                  log.error(message("auth.logout.failed", exception.getMessage(), System.currentTimeMillis() - startedAt),exception);
                  throw exception;
            }
      }

      private Claims validateRefreshToken(String refreshToken) {
            try {
                  return jwtService.validateRefreshToken(refreshToken);
            } catch (JwtException | IllegalArgumentException exception) {
                  throw new InvalidTokenException(message("auth.token.refresh.invalid"));
            }
      }

      private User findUser(String identifier) {
            if (identifier.contains("@")) {
                  return userRepository.findByEmailIgnoreCase(identifier.toLowerCase(Locale.ROOT)).orElseThrow(() -> new InvalidCredentialsException(message("auth.login.invalid")));
            }
            return userRepository.findByUsernameIgnoreCase(identifier).orElseThrow(() -> new InvalidCredentialsException(message("auth.login.invalid")));
      }
}
