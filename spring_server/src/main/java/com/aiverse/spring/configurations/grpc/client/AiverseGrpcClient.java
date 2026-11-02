package com.aiverse.spring.configurations.grpc.client;

import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Component;

import com.aiverse.grpc.AiverseServiceGrpc;
import com.aiverse.grpc.PingRequest;
import com.aiverse.grpc.PingResponse;
import com.aiverse.grpc.ServerStatusRequest;
import com.aiverse.grpc.ServerStatusResponse;
import com.aiverse.spring.configurations.rabbitmqs.RabbitMQService;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.StatusRuntimeException;
import jakarta.annotation.PreDestroy;

@Component
public class AiverseGrpcClient {

      private static final Logger log = LoggerFactory.getLogger(AiverseGrpcClient.class);

      private final RabbitMQService rabbitMQService;
      private final MessageSource messages;
      private final ManagedChannel channel;
      private final AiverseServiceGrpc.AiverseServiceBlockingStub stub;

      public AiverseGrpcClient(
                  RabbitMQService rabbitMQService,
                  MessageSource messages,
                  @Value("${aiverse.grpc.client.host}") String host,
                  @Value("${aiverse.grpc.client.port}") int port) {
            this.rabbitMQService = rabbitMQService;
            this.messages = messages;
            this.channel = ManagedChannelBuilder.forAddress(host, port).usePlaintext().build();
            this.stub = AiverseServiceGrpc.newBlockingStub(channel);
            log.info(message("grpc.client.configured", host, String.valueOf(port)));
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      public PingResponse ping(String requestMessage) {
            try {
                  log.info(message("grpc.client.ping.started", requestMessage));
                  PingResponse response = stub.withDeadlineAfter(10, TimeUnit.SECONDS)
                              .ping(PingRequest.newBuilder().setMessage(requestMessage).build());
                  log.info(message("grpc.client.ping.completed", response.getServer()));
                  rabbitMQService.raiseEventSafely("GRPC_PING", Map.of(
                              "request_message", requestMessage,
                              "response_message", response.getMessage(),
                              "server", response.getServer()));
                  return response;
            } catch (StatusRuntimeException error) {
                  log.error(message("grpc.client.ping.failed", error.getStatus()), error);
                  throw error;
            }
      }

      public ServerStatusResponse getServerStatus() {
            try {
                  log.info(message("grpc.client.status.started"));
                  ServerStatusResponse response = stub.withDeadlineAfter(10, TimeUnit.SECONDS)
                              .getServerStatus(ServerStatusRequest.getDefaultInstance());
                  log.info(message("grpc.client.status.completed", response.getServer(), response.getStatus()));
                  rabbitMQService.raiseEventSafely("GRPC_SERVER_STATUS", Map.of(
                              "server", response.getServer(),
                              "status", response.getStatus(),
                              "version", response.getVersion()));
                  return response;
            } catch (StatusRuntimeException error) {
                  log.error(message("grpc.client.status.failed", error.getStatus()), error);
                  throw error;
            }
      }

      @PreDestroy
      public void shutdown() {
            try {
                  channel.shutdown();
                  if (!channel.awaitTermination(5, TimeUnit.SECONDS)) {
                        channel.shutdownNow();
                  }
                  log.info(message("grpc.client.shutdown"));
            } catch (InterruptedException error) {
                  Thread.currentThread().interrupt();
                  channel.shutdownNow();
            }
      }
}
