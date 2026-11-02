package com.aiverse.spring.configurations.socketio.configuration;

import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.corundumstudio.socketio.SocketIOServer;

@Configuration
public class SocketIOConfiguration {

      private static final Logger log = LoggerFactory.getLogger(SocketIOConfiguration.class);

      private final MessageSource messages;

      public SocketIOConfiguration(MessageSource messages) {
            this.messages = messages;
      }

      @Bean
      public SocketIOServer socketIOServer(
                  @Value("${aiverse.socketio.hostname}") String hostname,
                  @Value("${aiverse.socketio.port}") int port,
                  @Value("${aiverse.socketio.origin}") String origin) {
            com.corundumstudio.socketio.Configuration configuration = new com.corundumstudio.socketio.Configuration();
            configuration.setHostname(hostname);
            configuration.setPort(port);
            configuration.setOrigin(origin);
            log.info(messages.getMessage("socketio.configured", new Object[] { hostname, String.valueOf(port) }, Locale.getDefault()));
            return new SocketIOServer(configuration);
      }
}
