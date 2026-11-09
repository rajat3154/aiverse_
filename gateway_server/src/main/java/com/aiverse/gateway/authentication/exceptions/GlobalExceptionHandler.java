package com.aiverse.gateway.authentication.exceptions;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import io.jsonwebtoken.JwtException;
import jakarta.servlet.http.HttpServletRequest;

@RestControllerAdvice
public class GlobalExceptionHandler {

      private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

      private final MessageSource messages;

      public GlobalExceptionHandler(MessageSource messages) {
            this.messages = messages;
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      @ExceptionHandler(InvalidCredentialsException.class)
      public ResponseEntity<Map<String, Object>> handleInvalidCredentials(InvalidCredentialsException exception) {
            return error(HttpStatus.UNAUTHORIZED, exception.getMessage());
      }

      @ExceptionHandler(InvalidTokenException.class)
      public ResponseEntity<Map<String, Object>> handleInvalidToken(InvalidTokenException exception) {
            return error(HttpStatus.UNAUTHORIZED, exception.getMessage());
      }

      @ExceptionHandler(JwtException.class)
      public ResponseEntity<Map<String, Object>> handleJwt(JwtException exception) {
            return error(HttpStatus.UNAUTHORIZED, message("auth.token.invalid"));
      }

      @ExceptionHandler(MethodArgumentNotValidException.class)
      public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException exception) {
            String details = exception.getBindingResult().getFieldErrors().stream()
                        .map(fieldError -> fieldError.getDefaultMessage())
                        .collect(Collectors.joining(", "));
            log.warn(message("auth.request.invalid", details));
            return error(HttpStatus.BAD_REQUEST, details);
      }

      @ExceptionHandler(HttpMessageNotReadableException.class)
      public ResponseEntity<Map<String, Object>> handleMalformed(HttpMessageNotReadableException exception) {
            log.warn(message("auth.request.invalid", exception.getMostSpecificCause().getMessage()));
            return error(HttpStatus.BAD_REQUEST, message("auth.request.malformed"));
      }

      @ExceptionHandler(RedisConnectionFailureException.class)
      public ResponseEntity<Map<String, Object>> handleRedisUnavailable(RedisConnectionFailureException exception) {
            log.error(message("error.redis.unavailable", exception.getMessage()), exception);
            return error(HttpStatus.SERVICE_UNAVAILABLE, message("error.service.unavailable"));
      }

      @ExceptionHandler(Exception.class)
      public ResponseEntity<Map<String, Object>> handleUnexpected(Exception exception, HttpServletRequest request) {
            log.error(message("error.unexpected.logged", request.getMethod(), request.getRequestURI()), exception);
            return error(HttpStatus.INTERNAL_SERVER_ERROR, message("error.unexpected"));
      }

      private ResponseEntity<Map<String, Object>> error(HttpStatus status, String message) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("timestamp", Instant.now().toString());
            body.put("status", status.value());
            body.put("error", status.getReasonPhrase());
            body.put("message", message);
            return ResponseEntity.status(status).body(body);
      }
}
