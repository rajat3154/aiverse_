package com.aiverse.spring.modules.authentication.users.exceptions;

public class UsernameAlreadyExistsException extends RuntimeException {

      public UsernameAlreadyExistsException(String message) {
            super(message);
      }
}
