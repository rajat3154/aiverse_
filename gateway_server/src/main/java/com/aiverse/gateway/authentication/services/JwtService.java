
package com.aiverse.gateway.authentication.services;

import java.util.Date;
import java.util.Locale;
import java.util.UUID;
import javax.crypto.SecretKey;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Service;

@Service
public class JwtService {
      private static final Logger log = LoggerFactory.getLogger(JwtService.class);

      private final SecretKey signingKey;
      private final long accessTokenExpiration;
      private final long refreshTokenExpiration;
      private final MessageSource messages;

      public JwtService(
                  @Value("${aiverse.auth.jwt.secret}") String secret,
                  @Value("${aiverse.auth.jwt.access-token-expiration}") long accessTokenExpiration,
                  @Value("${aiverse.auth.jwt.refresh-token-expiration}") long refreshTokenExpiration,
                  MessageSource messages) {
            this.messages = messages;
            byte[] keyBytes;
            try {
                  keyBytes = Decoders.BASE64.decode(secret);
            } catch (RuntimeException exception) {
                  throw new IllegalStateException(message("jwt.secret.invalid"), exception);
            }
            if (keyBytes.length < 32) {
                  throw new IllegalStateException(message("jwt.secret.invalid"));
            }
            this.signingKey = Keys.hmacShaKeyFor(keyBytes);
            this.accessTokenExpiration = accessTokenExpiration;
            this.refreshTokenExpiration = refreshTokenExpiration;
            log.info(message("jwt.initialized", accessTokenExpiration, refreshTokenExpiration));
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      public String generateAccessToken(UUID userId, String email, String username, String role) {
            Date now = new Date();
            return Jwts.builder()
                        .subject(userId.toString())
                        .claim("email", email)
                        .claim("username", username)
                        .claim("role", role)
                        .claim("token_type", "access")
                        .issuedAt(now)
                        .expiration(new Date(now.getTime() + accessTokenExpiration))
                        .signWith(signingKey, Jwts.SIG.HS256)
                        .compact();
      }

      public String generateRefreshToken(UUID userId) {
            Date now = new Date();
            return Jwts.builder()
                        .id(UUID.randomUUID().toString())
                        .subject(userId.toString())
                        .claim("token_type", "refresh")
                        .issuedAt(now)
                        .expiration(new Date(now.getTime() + refreshTokenExpiration))
                        .signWith(signingKey, Jwts.SIG.HS256)
                        .compact();
      }

      public Claims validateAccessToken(String token) {
            Claims claims = parseToken(token);
            if (!"access".equals(claims.get("token_type", String.class))) {
                  throw new JwtException("Invalid token type.");
            }
            return claims;
      }

      public Claims validateRefreshToken(String token) {
            Claims claims = parseToken(token);
            if (!"refresh".equals(claims.get("token_type", String.class))) {
                  throw new JwtException("Invalid token type.");
            }
            if (claims.getId() == null) {
                  throw new JwtException("Refresh token ID is missing.");
            }
            return claims;
      }

      private Claims parseToken(String token) {
            Jws<Claims> parsed = Jwts.parser().verifyWith(signingKey).build().parseSignedClaims(token);
            return parsed.getPayload();
      }

      public long getAccessTokenExpiration() {
            return accessTokenExpiration;
      }

      public long getRefreshTokenExpiration() {
            return refreshTokenExpiration;
      }

      public UUID getUserId(Claims claims) {
            return UUID.fromString(claims.getSubject());
      }

      public String getTokenId(Claims claims) {
            return claims.getId();
      }
}
