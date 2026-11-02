package com.aiverse.spring.configurations.cloudinaries.configuration;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.cloudinary.Cloudinary;

@Configuration
public class CloudinaryConfig {

      private static final Logger log = LoggerFactory.getLogger(CloudinaryConfig.class);

      private final MessageSource messages;

      public CloudinaryConfig(MessageSource messages) {
            this.messages = messages;
      }

      @Bean
      public Cloudinary cloudinary(
                  @Value("${cloudinary.cloud-name:}") String cloudName,
                  @Value("${cloudinary.api-key:}") String apiKey,
                  @Value("${cloudinary.api-secret:}") String apiSecret) {
            Map<String, Object> config = new HashMap<>();
            if (cloudName.isBlank() || apiKey.isBlank() || apiSecret.isBlank()) {
                  log.warn(messages.getMessage("cloudinary.config.missing", null, Locale.getDefault()));
                  return new Cloudinary(config);
            }
            config.put("cloud_name", cloudName);
            config.put("api_key", apiKey);
            config.put("api_secret", apiSecret);
            config.put("secure", true);
            log.info(messages.getMessage("cloudinary.initialized", new Object[] { cloudName }, Locale.getDefault()));
            return new Cloudinary(config);
      }
}
