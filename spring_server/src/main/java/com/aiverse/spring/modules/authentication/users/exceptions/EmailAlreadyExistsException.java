package com.aiverse.spring.modules.authentication.users.exceptions;

public class EmailAlreadyExistsException extends RuntimeException {

      public EmailAlreadyExistsException(String message) {
            super(message);
      }
}
