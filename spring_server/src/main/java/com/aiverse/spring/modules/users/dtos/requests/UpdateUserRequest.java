package com.aiverse.spring.modules.users.dtos.requests;

import java.time.LocalDate;

import com.aiverse.spring.modules.authentication.users.enums.AccountType;
import com.aiverse.spring.modules.authentication.users.enums.Gender;
import com.aiverse.spring.modules.authentication.users.enums.Role;

import jakarta.validation.constraints.Email;
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
public class UpdateUserRequest {

      @Size(max = 100, message = "First name must not exceed 100 characters")
      private String firstName;

      @Size(max = 100, message = "Last name must not exceed 100 characters")
      private String lastName;

      @Email(message = "Invalid email address")
      @Size(max = 255, message = "Email must not exceed 255 characters")
      private String email;

      @Size(min = 3, max = 50, message = "Username must be between 3 and 50 characters")
      @Pattern(regexp = "^[a-zA-Z0-9_.]+$", message = "Username can contain only letters, numbers, underscores and dots")
      private String username;

      private LocalDate dateOfBirth;

      @Pattern(regexp = "^[+]?[0-9]{10,15}$", message = "Invalid phone number")
      private String phoneNumber;

      @Size(max = 500, message = "Bio must not exceed 500 characters")
      private String bio;

      @Size(max = 150, message = "Location must not exceed 150 characters")
      private String location;

      @Size(max = 255, message = "Website must not exceed 255 characters")
      @Pattern(regexp = "^(https?://).+", message = "Website must be a valid URL starting with http:// or https://")
      private String website;

      private Role role;
      private AccountType accountType;
      private Gender gender;
      private Boolean enabled;
}
