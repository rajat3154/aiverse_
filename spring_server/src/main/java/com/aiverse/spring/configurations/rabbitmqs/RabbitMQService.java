package com.aiverse.spring.configurations.rabbitmqs;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Service;

@Service
public class RabbitMQService {

      private static final Logger log = LoggerFactory.getLogger(RabbitMQService.class);

      private final RabbitTemplate rabbitTemplate;
      private final MessageSource messages;

      private final String exchangeName;
      private final String requestQueue;
      private final String responseQueue;

      public RabbitMQService(
                  RabbitTemplate rabbitTemplate,
                  MessageSource messages,
                  @Value("${aiverse.rabbitmq.exchange}") String exchangeName,
                  @Value("${aiverse.rabbitmq.request-queue}") String requestQueue,
                  @Value("${aiverse.rabbitmq.response-queue}") String responseQueue) {
            this.rabbitTemplate = rabbitTemplate;
            this.messages = messages;
            this.exchangeName = exchangeName;
            this.requestQueue = requestQueue;
            this.responseQueue = responseQueue;
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      public void publishRequest(Object message) {
            try {
                  log.info(message("rabbitmq.publish.request.started", requestQueue));
                  rabbitTemplate.convertAndSend(exchangeName, requestQueue, message);
                  log.info(message("rabbitmq.publish.request.completed", requestQueue));
            } catch (Exception error) {
                  log.error(message("rabbitmq.publish.request.failed", error.getMessage()), error);
                  throw error;
            }
      }

      public void raiseEvent(String eventType, Map<String, Object> payload) {
            String eventId = UUID.randomUUID().toString();
            Map<String, Object> event = new LinkedHashMap<>();
            event.put("event_type", eventType);
            event.put("event_id", eventId);
            event.put("source", "spring-boot");
            event.put("timestamp", Instant.now().toString());
            event.put("payload", payload);
            log.info(message("rabbitmq.event.raising", eventType, eventId));
            publishRequest(event);
      }

      public void raiseEventSafely(String eventType, Map<String, Object> payload) {
            try {
                  raiseEvent(eventType, payload);
            } catch (Exception error) {
                  log.error(message("rabbitmq.event.failed", eventType, error.getMessage()), error);
            }
      }

      public void publishResponse(String message) {
            try {
                  log.info(message("rabbitmq.publish.response.started", responseQueue));
                  rabbitTemplate.convertAndSend(exchangeName, responseQueue, message);
                  log.info(message("rabbitmq.publish.response.completed", responseQueue));
            } catch (Exception error) {
                  log.error(message("rabbitmq.publish.response.failed", error.getMessage()), error);
                  throw error;
            }
      }

      @RabbitListener(queues = "${aiverse.rabbitmq.response-queue}")
      public void consumeResponse(String message) {
            log.info(message("rabbitmq.consume.response.received", responseQueue));
            log.debug(message("rabbitmq.consume.response.payload", message));
            try {
                  processResponse(message);
            } catch (Exception error) {
                  log.error(message("rabbitmq.consume.response.failed", error.getMessage()), error);
            }
      }

      private void processResponse(String message) {
            log.info(message("rabbitmq.consume.response.processing"));

            // Your actual response processing goes here.
      }
}
