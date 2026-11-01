package com.aiverse.spring.configurations.databases;

import jakarta.annotation.PostConstruct;
import java.sql.Connection;
import java.util.Locale;
import javax.sql.DataSource;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DatabaseConfiguration {

      private static final Logger log = LoggerFactory.getLogger(DatabaseConfiguration.class);
      private final DataSource dataSource;
      private final MessageSource messages;

      public DatabaseConfiguration(DataSource dataSource, MessageSource messages) {
            this.dataSource = dataSource;
            this.messages = messages;
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      @PostConstruct
      public void initializeDatabase() {
            long startedAt = System.currentTimeMillis();
            log.info(message("database.init.started"));
            try (Connection connection = dataSource.getConnection()) {
                  log.info(message("database.init.established", System.currentTimeMillis() - startedAt));
                  log.info(message("database.info.name", connection.getCatalog()));
                  log.info(message("database.info.product", connection.getMetaData().getDatabaseProductName()));
                  log.info(message("database.info.version", connection.getMetaData().getDatabaseProductVersion()));
            } catch (Exception exception) {
                  log.error(message("database.init.failed", exception.getMessage()), exception);
                  throw new IllegalStateException(message("database.init.unavailable"), exception);
            }
      }
}
