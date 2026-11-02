package com.aiverse.spring.configurations.websockets.configuration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

import com.aiverse.spring.configurations.websockets.handlers.WebSocketHandler;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

      private final WebSocketHandler webSocketHandler;
      private final String[] allowedOrigins;

      public WebSocketConfig(
                  WebSocketHandler webSocketHandler,
                  @Value("${aiverse.websocket.allowed-origins}") String[] allowedOrigins) {
            this.webSocketHandler = webSocketHandler;
            this.allowedOrigins = allowedOrigins;
      }

      @Override
      public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
            registry.addHandler(webSocketHandler, "/ws/{userId}")
                    .addInterceptors(new UserHandshakeInterceptor())
                    .setAllowedOriginPatterns(allowedOrigins);
      }
}
