package com.aiverse.spring.modules.authentication.users.dtos.requests;

import java.time.LocalDate;

import com.aiverse.spring.modules.authentication.users.enums.AccountType;
import com.aiverse.spring.modules.authentication.users.enums.Gender;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter 
@Setter 
@Builder
@NoArgsConstructor 
@AllArgsConstructor 
public class SignupRequest {

      @NotBlank (message = "First name is required")
      @Size (max = 100, message = "First name must not exceed 100 characters")
      private String firstName;

      @NotBlank(message = "Last name is required")
      @Size(max = 100, message = "Last name must not exceed 100 characters")
      private String lastName;

      @NotBlank(message = "Email is required")
      @Email (message = "Invalid email address")
      @Size(max = 255, message = "Email must not exceed 255 characters")
      private String email;

      @NotBlank(message = "Username is required")
      @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
      @Pattern (regexp = "^[a-zA-Z0-9_.]+$", message = "Username can contain only letters, numbers, underscores and dots")
      private String username;

      private LocalDate dateOfBirth;

      @Pattern(regexp = "^[+]?[0-9]{10,15}$", message = "Invalid phone number")
      private String phoneNumber;

      @Size(max = 1000, message = "Profile photo URL must not exceed 1000 characters")
      private String profilePhoto;

      @Size(max = 1000, message = "Banner URL must not exceed 1000 characters")
      private String banner;

      @NotBlank(message = "Password is required")
      @Size(min = 8, max = 100, message = "Password must be between 8 and 100 characters")
      private String password;

      @NotBlank(message = "Confirm password is required")
      private String confirmPassword;

      @NotNull (message = "Account type is required")
      private AccountType accountType;

      private Gender gender;
}