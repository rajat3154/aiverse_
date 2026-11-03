package com.aiverse.gateway.cache.redis;

import java.time.Duration;
import java.util.Locale;
import java.util.Optional;

import org.springframework.context.MessageSource;
import org.springframework.data.redis.core.StringRedisTemplate;

public class RedisService {

      private final StringRedisTemplate redisTemplate;
      private final String keyPrefix;
      private final MessageSource messages;

      public RedisService(StringRedisTemplate redisTemplate, String keyPrefix, MessageSource messages) {
            this.redisTemplate = redisTemplate;
            this.keyPrefix = keyPrefix.endsWith(":") ? keyPrefix : keyPrefix + ":";
            this.messages = messages;
      }

      private String buildKey(String key) {
            if (key == null || key.isBlank()) {
                  throw new IllegalArgumentException(messages.getMessage("redis.key.empty", null, Locale.getDefault()));
            }
            return keyPrefix + key.replaceFirst("^:+", "");
      }

      public void set(String key, String value) {
            redisTemplate.opsForValue().set(buildKey(key), value);
      }

      public void set(String key, String value, Duration ttl) {
            redisTemplate.opsForValue().set(buildKey(key), value, ttl);
      }

      public Optional<String> get(String key) {
            return Optional.ofNullable(redisTemplate.opsForValue().get(buildKey(key)));
      }

      public boolean exists(String key) {
            return Boolean.TRUE.equals(redisTemplate.hasKey(buildKey(key)));
      }

      public boolean delete(String key) {
            return Boolean.TRUE.equals(redisTemplate.delete(buildKey(key)));
      }

      public long increment(String key) {
            Long result = redisTemplate.opsForValue().increment(buildKey(key));
            return result == null ? 0 : result;
      }

      public void expire(String key, Duration ttl) {
            redisTemplate.expire(buildKey(key), ttl);
      }
}
