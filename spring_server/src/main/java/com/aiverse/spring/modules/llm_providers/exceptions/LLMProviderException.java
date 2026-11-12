package com.aiverse.spring.modules.llm_providers.exceptions;

import org.springframework.http.HttpStatus;

public class LLMProviderException extends RuntimeException {

      private final HttpStatus status;

      public LLMProviderException(HttpStatus status, String message) {
            super(message);
            this.status = status;
      }

      public HttpStatus getStatus() {
            return status;
      }
}
