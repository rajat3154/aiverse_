package com.aiverse.spring.configurations.grpc.server;

import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Component;

import com.aiverse.grpc.AiverseServiceGrpc;
import com.aiverse.grpc.PingRequest;
import com.aiverse.grpc.PingResponse;
import com.aiverse.grpc.ServerStatusRequest;
import com.aiverse.grpc.ServerStatusResponse;

import io.grpc.Status;
import io.grpc.stub.StreamObserver;

@Component
public class AiverseGrpcService extends AiverseServiceGrpc.AiverseServiceImplBase {

      private static final Logger log = LoggerFactory.getLogger(AiverseGrpcService.class);
      private static final String SERVER_NAME = "AIVERSE-SPRING";

      private final MessageSource messages;

      public AiverseGrpcService(MessageSource messages) {
            this.messages = messages;
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      @Override
      public void ping(PingRequest request, StreamObserver<PingResponse> responseObserver) {
            try {
                  log.info(message("grpc.ping.received", request.getMessage()));
                  PingResponse response = PingResponse.newBuilder()
                              .setMessage("Pong from Spring Boot: " + request.getMessage())
                              .setServer(SERVER_NAME)
                              .setTimestamp(System.currentTimeMillis())
                              .build();
                  responseObserver.onNext(response);
                  responseObserver.onCompleted();
                  log.info(message("grpc.ping.completed"));
            } catch (Exception error) {
                  log.error(message("grpc.ping.failed", error.getMessage()), error);
                  responseObserver.onError(Status.INTERNAL
                              .withDescription("Failed to process Ping request")
                              .withCause(error)
                              .asRuntimeException());
            }
      }

      @Override
      public void getServerStatus(ServerStatusRequest request, StreamObserver<ServerStatusResponse> responseObserver) {
            try {
                  log.info(message("grpc.status.received"));
                  ServerStatusResponse response = ServerStatusResponse.newBuilder()
                              .setServer(SERVER_NAME)
                              .setStatus("UP")
                              .setVersion("1.0.0")
                              .build();
                  responseObserver.onNext(response);
                  responseObserver.onCompleted();
                  log.info(message("grpc.status.completed"));
            } catch (Exception error) {
                  log.error(message("grpc.status.failed", error.getMessage()), error);
                  responseObserver.onError(Status.INTERNAL
                              .withDescription("Failed to get server status")
                              .withCause(error)
                              .asRuntimeException());
            }
      }
}
