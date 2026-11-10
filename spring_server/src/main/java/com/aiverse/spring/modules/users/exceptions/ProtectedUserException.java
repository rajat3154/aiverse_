package com.aiverse.spring.modules.users.exceptions;

public class ProtectedUserException extends RuntimeException {
      public ProtectedUserException(String message) {
            super(message);
      }
}
