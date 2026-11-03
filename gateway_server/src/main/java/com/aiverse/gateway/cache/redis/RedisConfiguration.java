package com.aiverse.gateway.cache.redis;

import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

@Configuration
@ConditionalOnProperty(name = "aiverse.redis.enabled", havingValue = "true", matchIfMissing = true)
public class RedisConfiguration {

      private static final Logger log = LoggerFactory.getLogger(RedisConfiguration.class);
      private final MessageSource messages;

      public RedisConfiguration(MessageSource messages) {
            this.messages = messages;
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      @Bean
      public StringRedisTemplate redisTemplate(RedisConnectionFactory connectionFactory) {
            log.info(message("redis.configuration.template"));
            return new StringRedisTemplate(connectionFactory);
      }

      @Bean
      public RedisService redisService(StringRedisTemplate redisTemplate,@Value("${aiverse.redis.key-prefix:aiverse:gateway}") String prefix) {
            log.info(message("redis.configuration.service", prefix));
            return new RedisService(redisTemplate, prefix, messages);
      }
}
