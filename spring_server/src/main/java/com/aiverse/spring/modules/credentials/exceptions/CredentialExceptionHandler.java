package com.aiverse.spring.modules.credentials.exceptions;

import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import jakarta.servlet.http.HttpServletRequest;

@RestControllerAdvice(basePackages = "com.aiverse.spring.modules.credentials")
public class CredentialExceptionHandler {

      private static final Logger log = LoggerFactory.getLogger(CredentialExceptionHandler.class);

      private final MessageSource messages;

      public CredentialExceptionHandler(MessageSource messages) {
            this.messages = messages;
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      @ExceptionHandler(CredentialNotFoundException.class)
      public ResponseEntity<Map<String, String>> handleNotFound(CredentialNotFoundException exception) {
            return rejected(HttpStatus.NOT_FOUND, exception.getMessage());
      }

      @ExceptionHandler(CredentialAlreadyExistsException.class)
      public ResponseEntity<Map<String, String>> handleDuplicate(CredentialAlreadyExistsException exception) {
            return rejected(HttpStatus.CONFLICT, exception.getMessage());
      }

      /** Two concurrent creates with the same name: the database unique constraint is the last line of defence. */
      @ExceptionHandler(DataIntegrityViolationException.class)
      public ResponseEntity<Map<String, String>> handleIntegrity(DataIntegrityViolationException exception) {
            // log the constraint / cause type only: the exception text can carry the SQL and its values
            Throwable cause = exception.getMostSpecificCause();
            log.warn(message("credentials.integrity.violation", cause.getClass().getSimpleName()));
            String text = String.valueOf(cause.getMessage()).contains("uk_credentials_user_name")
                        ? message("credentials.name.exists")
                        : message("credentials.conflict");
            return respond(HttpStatus.CONFLICT, text);
      }

      @ExceptionHandler(MissingRequestHeaderException.class)
      public ResponseEntity<Map<String, String>> handleMissingHeader(MissingRequestHeaderException exception, HttpServletRequest request) {
            log.warn(message("credentials.identity.missing", request.getRequestURI()));
            return respond(HttpStatus.UNAUTHORIZED, message("credentials.identity.required"));
      }

      @ExceptionHandler(MethodArgumentTypeMismatchException.class)
      public ResponseEntity<Map<String, String>> handleTypeMismatch(MethodArgumentTypeMismatchException exception, HttpServletRequest request) {
            if (exception.getParameter().hasParameterAnnotation(RequestHeader.class)) {
                  log.warn(message("credentials.identity.invalid", request.getRequestURI()));
                  return respond(HttpStatus.UNAUTHORIZED, message("credentials.identity.required"));
            }
            return rejected(HttpStatus.BAD_REQUEST, message("credentials.id.invalid"));
      }

      @ExceptionHandler(MethodArgumentNotValidException.class)
      public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException exception, HttpServletRequest request) {
            String details = exception.getBindingResult().getFieldErrors().stream()
                        .map(fieldError -> fieldError.getDefaultMessage())
                        .collect(Collectors.joining(", "));
            log.warn(message("credentials.validation.failed", request.getRequestURI(), details));
            return respond(HttpStatus.BAD_REQUEST, details);
      }

      private ResponseEntity<Map<String, String>> rejected(HttpStatus status, String text) {
            log.debug(message("credentials.request.rejected", status.value(), text));
            return respond(status, text);
      }

      private ResponseEntity<Map<String, String>> respond(HttpStatus status, String text) {
            return ResponseEntity.status(status).body(Map.of("status", "error", "message", text));
      }
}
