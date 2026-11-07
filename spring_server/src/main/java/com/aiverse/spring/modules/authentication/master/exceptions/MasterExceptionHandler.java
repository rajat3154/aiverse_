package com.aiverse.spring.modules.authentication.master.exceptions;

import java.util.Locale;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;


@RestControllerAdvice(basePackages = "com.aiverse.spring.modules.authentication.master")
public class MasterExceptionHandler {

      private static final Logger log = LoggerFactory.getLogger(MasterExceptionHandler.class);

      private final MessageSource messages;

      public MasterExceptionHandler(MessageSource messages) {
            this.messages = messages;
      }

      @ExceptionHandler(MasterAccessDeniedException.class)
      public ResponseEntity<Map<String, String>> handleAccessDenied(MasterAccessDeniedException exception) {
            log.warn(messages.getMessage("master.create.denied", new Object[] { exception.getMessage() }, Locale.getDefault()));
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("status", "error", "message", exception.getMessage()));
      }

      @ExceptionHandler(MasterAlreadyExistsException.class)
      public ResponseEntity<Map<String, String>> handleMasterAlreadyExists(MasterAlreadyExistsException exception) {
            log.warn(messages.getMessage("master.create.rejected", new Object[] { exception.getMessage() }, Locale.getDefault()));
            return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(Map.of("status", "error", "message", exception.getMessage()));
      }
}
