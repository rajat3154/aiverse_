package com.aiverse.gateway.cache.redis;

import java.time.Instant;
import java.util.Locale;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.MessageSource;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/health/redis")
@ConditionalOnProperty(name = "aiverse.redis.enabled", havingValue = "true", matchIfMissing = true)
public class RedisHealthController {

      private static final Logger log = LoggerFactory.getLogger(RedisHealthController.class);
      private final RedisConnectionFactory connectionFactory;
      private final MessageSource messages;

      public RedisHealthController(RedisConnectionFactory connectionFactory, MessageSource messages) {
            this.connectionFactory = connectionFactory;
            this.messages = messages;
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      @GetMapping
      public Map<String, Object> health() {
            RedisConnection connection = null;
            String service = message("redis.health.service");
            try {
                  connection = connectionFactory.getConnection();
                  String response = connection.ping();
                  return Map.of(
                              "service", service,
                              "redis", "connected",
                              "response", response,
                              "status", "healthy",
                              "timestamp", Instant.now().toString());

            } catch (Exception exception) {
                  log.warn(message("redis.health.failed", exception.getMessage()), exception);
                  return Map.of(
                              "service", service,
                              "redis", "disconnected",
                              "status", "degraded",
                              "timestamp", Instant.now().toString());
            } finally {
                  if (connection != null) {
                        connection.close();
                  }
            }
      }
}
