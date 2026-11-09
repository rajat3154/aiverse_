package com.aiverse.gateway.authentication.configurations;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Instant;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.HttpServletResponse;

@Component
public class JsonErrorWriter {

      public void write(HttpServletResponse response, HttpStatus status, String message) throws IOException {
            response.setStatus(status.value());
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.getWriter().write(String.format(
                        "{\"timestamp\":\"%s\",\"status\":%d,\"error\":\"%s\",\"message\":\"%s\"}",
                        Instant.now(), status.value(), escape(status.getReasonPhrase()), escape(message)));
      }

      private String escape(String value) {
            return value.replace("\\", "\\\\").replace("\"", "\\\"");
      }
}
