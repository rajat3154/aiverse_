package com.aiverse.spring.configurations.websockets.handlers;

import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketMessage;
import org.springframework.web.socket.WebSocketSession;

import com.aiverse.spring.configurations.websockets.management.WebSocketConnectionManager;

@Component
public class WebSocketHandler implements org.springframework.web.socket.WebSocketHandler {

      private static final Logger log = LoggerFactory.getLogger(WebSocketHandler.class);

      private final WebSocketConnectionManager connectionManager;
      private final MessageSource messages;

      public WebSocketHandler(WebSocketConnectionManager connectionManager, MessageSource messages) {
            this.connectionManager = connectionManager;
            this.messages = messages;
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      @Override
      public void afterConnectionEstablished(WebSocketSession session) {
            connectionManager.connect(getUserId(session), session);
      }

      @Override
      public void handleMessage(WebSocketSession session, WebSocketMessage<?> webSocketMessage) {
            String userId = getUserId(session);
            try {
                  String payload = webSocketMessage instanceof TextMessage text
                              ? text.getPayload()
                              : String.valueOf(webSocketMessage.getPayload());
                  log.info(message("websocket.message.received", userId));
                  connectionManager.sendToUser(userId, "Server received: " + payload);
            } catch (Exception error) {
                  log.error(message("websocket.message.failed", userId, error.getMessage()), error);
            }
      }

      @Override
      public void handleTransportError(WebSocketSession session, Throwable exception) {
            String userId = getUserId(session);
            log.error(message("websocket.transport.error", userId, exception.getMessage()), exception);
            connectionManager.disconnect(userId);
      }

      @Override
      public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
            String userId = getUserId(session);
            log.info(message("websocket.closed", userId, status));
            connectionManager.disconnect(userId);
      }

      @Override
      public boolean supportsPartialMessages() {
            return false;
      }

      private String getUserId(WebSocketSession session) {
            Object userId = session.getAttributes().get("userId");
            return userId == null ? session.getId() : userId.toString();
      }
}
