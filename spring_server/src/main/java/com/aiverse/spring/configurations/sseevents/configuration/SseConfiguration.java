package com.aiverse.spring.configurations.sseevents.configuration;

import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;

@Component
public class SseConfiguration {

      private static final Logger log = LoggerFactory.getLogger(SseConfiguration.class);

      private final MessageSource messages;
      private final Map<String, SseEmitter> connections = new ConcurrentHashMap<>();

      public SseConfiguration(MessageSource messages) {
            this.messages = messages;
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      @PostConstruct
      public void initializeSse() {
            log.info(message("sse.manager.initialized"));
      }

      @PreDestroy
      public void shutdownSse() {
            int count = connections.size();
            connections.values().forEach(SseEmitter::complete);
            connections.clear();
            log.info(message("sse.manager.stopped", count));
      }

      public SseEmitter connect(String clientId) {
            SseEmitter emitter = new SseEmitter(30 * 60 * 1000L);
            connections.put(clientId, emitter);
            emitter.onCompletion(() -> disconnect(clientId));
            emitter.onTimeout(() -> disconnect(clientId));
            emitter.onError(error -> disconnect(clientId));
            log.info(message("sse.connection.connected", clientId, connections.size()));
            try {
                  emitter.send(SseEmitter.event().name("connected").data(Map.of(
                              "clientId", clientId,
                              "message", "SSE connection established")));
            } catch (Exception error) {
                  log.error(message("sse.connection.ack.failed", clientId, error.getMessage()), error);
                  disconnect(clientId);
            }
            return emitter;
      }

      public void send(String clientId, String eventName, Object data) {
            SseEmitter emitter = connections.get(clientId);
            if (emitter == null) {
                  log.warn(message("sse.publish.no_connection", clientId));
                  return;
            }
            try {
                  emitter.send(SseEmitter.event().name(eventName).data(data));
                  log.info(message("sse.publish.completed", clientId, eventName));
            } catch (Exception error) {
                  log.error(message("sse.publish.failed", clientId, eventName, error.getMessage()), error);
                  disconnect(clientId);
            }
      }

      public void disconnect(String clientId) {
            SseEmitter emitter = connections.remove(clientId);
            if (emitter == null) {
                  return;
            }
            emitter.complete();
            log.info(message("sse.connection.disconnected", clientId));
      }

      public int getConnectionCount() {
            return connections.size();
      }
}
