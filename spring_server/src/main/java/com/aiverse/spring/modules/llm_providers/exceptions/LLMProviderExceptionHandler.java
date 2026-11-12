package com.aiverse.spring.modules.llm_providers.exceptions;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackages = "com.aiverse.spring.modules.llm_providers")
public class LLMProviderExceptionHandler {

      @ExceptionHandler(LLMProviderException.class)
      public ResponseEntity<Map<String, String>> handle(LLMProviderException exception) {
            return ResponseEntity.status(exception.getStatus()).body(Map.of("message", exception.getMessage()));
      }
}
