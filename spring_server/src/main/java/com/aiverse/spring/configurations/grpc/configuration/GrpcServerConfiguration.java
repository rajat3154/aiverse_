package com.aiverse.spring.configurations.grpc.configuration;

import java.io.IOException;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Component;

import com.aiverse.spring.configurations.grpc.server.AiverseGrpcService;

import io.grpc.Server;
import io.grpc.ServerBuilder;
import jakarta.annotation.PreDestroy;

@Component
public class GrpcServerConfiguration {

      private static final Logger log = LoggerFactory.getLogger(GrpcServerConfiguration.class);

      private final AiverseGrpcService grpcService;
      private final MessageSource messages;
      private final int grpcPort;
      private final String httpPort;
      private Server server;

      public GrpcServerConfiguration(
                  AiverseGrpcService grpcService,
                  MessageSource messages,
                  @Value("${aiverse.grpc.server.port}") int grpcPort,
                  @Value("${server.port}") String httpPort) {
            this.grpcService = grpcService;
            this.messages = messages;
            this.grpcPort = grpcPort;
            this.httpPort = httpPort;
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      // Started once the HTTP server is up: Render probes every open port while it looks for the web port,
      // so opening the gRPC port earlier only fills the logs with failed HTTP probes.
      @EventListener(ApplicationReadyEvent.class)
      public void start() {
            if (String.valueOf(grpcPort).equals(httpPort.trim())) {
                  throw new IllegalStateException(message("grpc.server.port.conflict", String.valueOf(grpcPort)));
            }
            try {
                  log.info(message("grpc.server.starting", String.valueOf(grpcPort)));
                  server = ServerBuilder.forPort(grpcPort).addService(grpcService).build().start();
                  log.info(message("grpc.server.started", String.valueOf(grpcPort)));
            } catch (IOException error) {
                  log.error(message("grpc.server.failed", error.getMessage()), error);
                  throw new IllegalStateException(message("grpc.server.failed", error.getMessage()), error);
            }
      }

      @PreDestroy
      public void stop() {
            if (server == null) {
                  return;
            }
            try {
                  server.shutdown();
                  if (!server.awaitTermination(5, TimeUnit.SECONDS)) {
                        log.warn(message("grpc.server.stop.forced"));
                        server.shutdownNow();
                  }
                  log.info(message("grpc.server.stopped"));
            } catch (InterruptedException error) {
                  Thread.currentThread().interrupt();
                  server.shutdownNow();
            }
      }
}
