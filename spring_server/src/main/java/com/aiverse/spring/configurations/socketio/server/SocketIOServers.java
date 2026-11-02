package com.aiverse.spring.configurations.socketio.server;

import java.util.Locale;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.MessageSource;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import com.corundumstudio.socketio.SocketIOServer;

import jakarta.annotation.PreDestroy;

@Component
public class SocketIOServers {

      private static final Logger log = LoggerFactory.getLogger(SocketIOServers.class);

      private final SocketIOServer server;
      private final MessageSource messages;
      private final String socketIoPort;
      private final String httpPort;
      private boolean started;

      public SocketIOServers(
                  SocketIOServer server,
                  MessageSource messages,
                  @Value("${aiverse.socketio.port}") String socketIoPort,
                  @Value("${server.port}") String httpPort) {
            this.server = server;
            this.messages = messages;
            this.socketIoPort = socketIoPort.trim();
            this.httpPort = httpPort.trim();
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      // Started once the HTTP server is up, so Render's port scan does not pick this port instead of the web port.
      @EventListener(ApplicationReadyEvent.class)
      public void start() {
            if (socketIoPort.equals(httpPort)) {
                  throw new IllegalStateException(message("socketio.port.conflict", socketIoPort));
            }
            try {
                  server.addConnectListener(client -> {
                        String sid = client.getSessionId().toString();
                        client.sendEvent("connected", Map.of("sid", sid, "message", "Socket.IO connection established"));
                        log.info(message("socketio.client.connected", sid));
                  });
                  server.addDisconnectListener(client ->
                              log.info(message("socketio.client.disconnected", client.getSessionId().toString())));
                  server.addEventListener("ping", Object.class, (client, data, ackSender) -> {
                        client.sendEvent("pong", Map.of("message", "Pong from Spring Boot", "data", data));
                        log.info(message("socketio.ping.completed", client.getSessionId().toString()));
                  });
                  log.info(message("socketio.starting", socketIoPort));
                  server.start();
                  started = true;
                  log.info(message("socketio.started", socketIoPort));
            } catch (Exception error) {
                  log.error(message("socketio.failed", error.getMessage()), error);
                  throw error;
            }
      }

      @PreDestroy
      public void stop() {
            if (!started) {
                  return;
            }
            int count = server.getAllClients().size();
            try {
                  server.stop();
                  started = false;
                  log.info(message("socketio.stopped", count));
            } catch (Exception error) {
                  log.error(message("socketio.stop.failed", error.getMessage()), error);
            }
      }
}
