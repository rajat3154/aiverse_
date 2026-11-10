package com.aiverse.spring.modules.users.exceptions;

public class UserNotFoundException extends RuntimeException {
      public UserNotFoundException(String message) {
            super(message);
      }
}
