
package com.aiverse.gateway.config;

import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

      private static final Logger log = LoggerFactory.getLogger(CorsConfig.class);

      @Value("${aiverse.frontend.origin}")
      private String frontendOrigin;

      private final MessageSource messages;

      public CorsConfig(MessageSource messages) {
            this.messages = messages;
      }

      @Override
      public void addCorsMappings(CorsRegistry registry) {
            log.info(messages.getMessage("cors.configured", new Object[] { frontendOrigin }, Locale.getDefault()));
            registry.addMapping("/**")
                        .allowedOrigins(frontendOrigin)
                        .allowedMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
                        .allowedHeaders("*")
                        .allowCredentials(true)
                        .maxAge(3600);
      }
}
