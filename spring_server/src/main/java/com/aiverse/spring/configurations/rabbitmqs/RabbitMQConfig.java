package com.aiverse.spring.configurations.rabbitmqs;

import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMQConfig {

      private static final Logger log = LoggerFactory.getLogger(RabbitMQConfig.class);

      private final MessageSource messages;
      private final String exchangeName;
      private final String requestQueue;
      private final String responseQueue;

      public RabbitMQConfig(
                  MessageSource messages,
                  @Value("${aiverse.rabbitmq.exchange}") String exchangeName,
                  @Value("${aiverse.rabbitmq.request-queue}") String requestQueue,
                  @Value("${aiverse.rabbitmq.response-queue}") String responseQueue) {
            this.messages = messages;
            this.exchangeName = exchangeName;
            this.requestQueue = requestQueue;
            this.responseQueue = responseQueue;
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      @Bean
      DirectExchange aiverseExchange() {
            log.info(message("rabbitmq.exchange.creating", exchangeName));
            return new DirectExchange(exchangeName, true, false);
      }

      @Bean
      Queue requestQueue() {
            log.info(message("rabbitmq.queue.request.creating", requestQueue));
            return new Queue(requestQueue, true);
      }

      @Bean
      Queue responseQueue() {
            log.info(message("rabbitmq.queue.response.creating", responseQueue));
            return new Queue(responseQueue, true);
      }

      @Bean
      Binding requestBinding(Queue requestQueue, DirectExchange aiverseExchange) {
            log.info(message("rabbitmq.binding.request", this.requestQueue, exchangeName));
            return BindingBuilder.bind(requestQueue).to(aiverseExchange).with(this.requestQueue);
      }

      @Bean
      Binding responseBinding(Queue responseQueue, DirectExchange aiverseExchange) {
            log.info(message("rabbitmq.binding.response", this.responseQueue, exchangeName));
            return BindingBuilder.bind(responseQueue).to(aiverseExchange).with(this.responseQueue);
      }

      @Bean
      MessageConverter jsonMessageConverter() {
            return new JacksonJsonMessageConverter();
      }

      @Bean
      RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory, MessageConverter jsonMessageConverter) {
            log.info(message("rabbitmq.template.initializing"));
            RabbitTemplate template = new RabbitTemplate(connectionFactory);
            template.setMessageConverter(jsonMessageConverter);
            return template;
      }
}
