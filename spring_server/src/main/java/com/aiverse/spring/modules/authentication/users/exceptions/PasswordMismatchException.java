package com.aiverse.spring.modules.authentication.users.exceptions;

public class PasswordMismatchException extends RuntimeException {

      public PasswordMismatchException(String message) {
            super(message);
      }
}
