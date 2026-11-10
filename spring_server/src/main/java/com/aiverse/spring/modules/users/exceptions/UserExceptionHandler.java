package com.aiverse.spring.modules.users.exceptions;

import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import jakarta.servlet.http.HttpServletRequest;

import com.aiverse.spring.modules.authentication.users.exceptions.EmailAlreadyExistsException;
import com.aiverse.spring.modules.authentication.users.exceptions.UsernameAlreadyExistsException;

@RestControllerAdvice(basePackages = "com.aiverse.spring.modules.users")
public class UserExceptionHandler {

      private static final Logger log = LoggerFactory.getLogger(UserExceptionHandler.class);

      private final MessageSource messages;

      public UserExceptionHandler(MessageSource messages) {
            this.messages = messages;
      }

      @ExceptionHandler(UserNotFoundException.class)
      public ResponseEntity<Map<String, String>> handleNotFound(UserNotFoundException exception) {
            return error(HttpStatus.NOT_FOUND, exception.getMessage());
      }

      @ExceptionHandler({ EmailAlreadyExistsException.class, UsernameAlreadyExistsException.class })
      public ResponseEntity<Map<String, String>> handleConflict(RuntimeException exception) {
            return error(HttpStatus.CONFLICT, exception.getMessage());
      }

      @ExceptionHandler(ProtectedUserException.class)
      public ResponseEntity<Map<String, String>> handleProtected(ProtectedUserException exception) {
            return error(HttpStatus.FORBIDDEN, exception.getMessage());
      }

      @ExceptionHandler(MethodArgumentNotValidException.class)
      public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException exception, HttpServletRequest request) {
            String message = exception.getBindingResult().getFieldErrors().stream()
                        .map(fieldError -> fieldError.getDefaultMessage())
                        .collect(Collectors.joining(", "));
            // validation fails before the service runs, so nothing else records it
            log.warn(messages.getMessage("users.validation.failed", new Object[] { request.getRequestURI(), message },
                        Locale.getDefault()));
            return respond(HttpStatus.BAD_REQUEST, message);
      }

      private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
            log.debug(messages.getMessage("users.request.rejected", new Object[] { status.value(), message }, Locale.getDefault()));
            return respond(status, message);
      }

      private ResponseEntity<Map<String, String>> respond(HttpStatus status, String message) {
            return ResponseEntity.status(status).body(Map.of("status", "error", "message", message));
      }
}
