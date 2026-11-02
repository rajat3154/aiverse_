package com.aiverse.spring.configurations.websockets.management;

import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

@Component
public class WebSocketConnectionManager {

      private static final Logger log = LoggerFactory.getLogger(WebSocketConnectionManager.class);

      private final Map<String, WebSocketSession> activeConnections = new ConcurrentHashMap<>();
      private final MessageSource messages;

      public WebSocketConnectionManager(MessageSource messages) {
            this.messages = messages;
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      public void connect(String userId, WebSocketSession session) {
            activeConnections.put(userId, session);
            log.info(message("websocket.connected", userId, activeConnections.size()));
      }

      public void disconnect(String userId) {
            if (activeConnections.remove(userId) != null) {
                  log.info(message("websocket.disconnected", userId, activeConnections.size()));
            } else {
                  log.warn(message("websocket.disconnect.unknown", userId));
            }
      }

      public void sendToUser(String userId, String text) {
            WebSocketSession session = activeConnections.get(userId);
            if (session == null) {
                  log.warn(message("websocket.send.not_connected", userId));
                  return;
            }
            if (!session.isOpen()) {
                  log.warn(message("websocket.send.closed", userId));
                  disconnect(userId);
                  return;
            }
            try {
                  session.sendMessage(new TextMessage(text));
                  log.info(message("websocket.send.completed", userId));
            } catch (Exception error) {
                  log.error(message("websocket.send.failed", userId, error.getMessage()), error);
                  disconnect(userId);
            }
      }

      public void broadcast(String text) {
            int failed = 0;
            for (Map.Entry<String, WebSocketSession> entry : activeConnections.entrySet()) {
                  String userId = entry.getKey();
                  WebSocketSession session = entry.getValue();
                  try {
                        if (!session.isOpen()) {
                              failed++;
                              disconnect(userId);
                              continue;
                        }
                        session.sendMessage(new TextMessage(text));
                  } catch (Exception error) {
                        failed++;
                        log.error(message("websocket.broadcast.failed", userId, error.getMessage()), error);
                        disconnect(userId);
                  }
            }
            log.info(message("websocket.broadcast.completed", activeConnections.size(), failed));
      }

      public int closeAll() {
            int count = activeConnections.size();
            activeConnections.values().forEach(session -> {
                  try {
                        session.close();
                  } catch (Exception ignored) {
                        
                  }
            });
            activeConnections.clear();
            return count;
      }

      public int getConnectionCount() {
            return activeConnections.size();
      }
}
