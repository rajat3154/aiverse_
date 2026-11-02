package com.aiverse.spring.configurations.websockets;

import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Component;

import com.aiverse.spring.configurations.websockets.management.WebSocketConnectionManager;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

@Component
public class WebSocketInitializer {

      private static final Logger log = LoggerFactory.getLogger(WebSocketInitializer.class);

      private final WebSocketConnectionManager connectionManager;
      private final MessageSource messages;

      public WebSocketInitializer(WebSocketConnectionManager connectionManager, MessageSource messages) {
            this.connectionManager = connectionManager;
            this.messages = messages;
      }

      @PostConstruct
      public void initialize() {
            log.info(messages.getMessage("websocket.initialized", null, Locale.getDefault()));
      }

      @PreDestroy
      public void shutdown() {
            int count = connectionManager.closeAll();
            log.info(messages.getMessage("websocket.stopped", new Object[] { count }, Locale.getDefault()));
      }
}
