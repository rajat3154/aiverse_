package com.aiverse.gateway.cache.redis;

import java.time.Duration;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.data.redis.autoconfigure.LettuceClientConfigurationBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import io.lettuce.core.ClientOptions;
import io.lettuce.core.SocketOptions;
import io.lettuce.core.TimeoutOptions;

@Configuration
@ConditionalOnProperty(name = "aiverse.redis.enabled", havingValue = "true", matchIfMissing = true)
public class RedisClientOptionsConfiguration {

      @Bean
      public LettuceClientConfigurationBuilderCustomizer lettuceKeepAliveCustomizer() {
            return builder -> builder.clientOptions(ClientOptions.builder()
                        .socketOptions(SocketOptions.builder()
                        .connectTimeout(Duration.ofSeconds(5))
                        .keepAlive(SocketOptions.KeepAliveOptions.builder()
                                                .enable()
                                                .idle(Duration.ofSeconds(30))
                                                .interval(Duration.ofSeconds(10))
                                                .count(3)
                                                .build())
                        .build())
                        .timeoutOptions(TimeoutOptions.enabled(Duration.ofSeconds(5)))
                        .pingBeforeActivateConnection(true)
                        .autoReconnect(true)
                        .build());
      }
}
