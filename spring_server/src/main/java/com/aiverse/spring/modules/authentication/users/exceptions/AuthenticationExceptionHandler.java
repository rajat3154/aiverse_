package com.aiverse.spring.modules.authentication.users.exceptions;

import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackages = "com.aiverse.spring.modules.authentication")
public class AuthenticationExceptionHandler {

      @ExceptionHandler({ EmailAlreadyExistsException.class, UsernameAlreadyExistsException.class })
      public ResponseEntity<Map<String, String>> handleConflict(RuntimeException exception) {
            return error(HttpStatus.CONFLICT, exception.getMessage());
      }

      @ExceptionHandler(PasswordMismatchException.class)
      public ResponseEntity<Map<String, String>> handleBadRequest(PasswordMismatchException exception) {
            return error(HttpStatus.BAD_REQUEST, exception.getMessage());
      }

      @ExceptionHandler(MethodArgumentNotValidException.class)
      public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException exception) {
            String message = exception.getBindingResult().getFieldErrors().stream()
                        .map(fieldError -> fieldError.getDefaultMessage())
                        .collect(Collectors.joining(", "));
            return error(HttpStatus.BAD_REQUEST, message);
      }

      private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
            return ResponseEntity.status(status).body(Map.of("status", "error", "message", message));
      }
}
