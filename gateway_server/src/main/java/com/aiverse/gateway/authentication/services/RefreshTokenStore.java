
package com.aiverse.gateway.authentication.services;

import java.time.Duration;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.stereotype.Service;

@Service
public class RefreshTokenStore {
      private static final Logger log = LoggerFactory.getLogger(RefreshTokenStore.class);

      private static final String CONSUME_SCRIPT = """
                  if redis.call('GET', KEYS[1]) == ARGV[1] then
                      return redis.call('DEL', KEYS[1])
                  end
                  return 0
                  """;

      private final StringRedisTemplate redisTemplate;
      private final String keyPrefix;
      private final long refreshTokenExpiration;
      private final MessageSource messages;

      public RefreshTokenStore(StringRedisTemplate redisTemplate,
                  @Value("${aiverse.redis.key-prefix:aiverse:gateway}") String keyPrefix,
                  @Value("${aiverse.auth.jwt.refresh-token-expiration:604800000}") long refreshTokenExpiration,
                  MessageSource messages) {
            this.redisTemplate = redisTemplate;
            this.keyPrefix = keyPrefix;
            this.refreshTokenExpiration = refreshTokenExpiration;
            this.messages = messages;
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      public void register(UUID userId, String tokenId) {
            redisTemplate.opsForValue().set(buildKey(userId, tokenId), tokenId, Duration.ofMillis(refreshTokenExpiration));
            log.debug(message("auth.refresh.store.registered", userId, tokenId, refreshTokenExpiration));
      }

      /** Atomically removes the token; false means it was never issued, already used, revoked or expired. */
      public boolean consume(UUID userId, String tokenId) {
            Long result = redisTemplate.execute(
                        new DefaultRedisScript<>(CONSUME_SCRIPT, Long.class),
                        java.util.List.of(buildKey(userId, tokenId)),
                        tokenId);
            boolean consumed = result != null && result == 1L;
            if (consumed) {
                  log.debug(message("auth.refresh.store.consumed", userId, tokenId));
            } else {
                  // A valid, signed token that is no longer in the store has been used already: possible replay.
                  log.warn(message("auth.refresh.store.reuse", userId, tokenId));
            }
            return consumed;
      }

      public void revoke(UUID userId, String tokenId) {
            redisTemplate.delete(buildKey(userId, tokenId));
            log.info(message("auth.refresh.store.revoked", userId, tokenId));
      }

      private String buildKey(UUID userId, String tokenId) {
            return keyPrefix + ":auth:refresh:" + userId + ":" + tokenId;
      }
}
