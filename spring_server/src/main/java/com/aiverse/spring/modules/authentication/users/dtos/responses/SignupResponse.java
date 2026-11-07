package com.aiverse.spring.modules.authentication.users.dtos.responses;

import java.time.LocalDate;
import java.util.UUID;

import com.aiverse.spring.modules.authentication.users.enums.AccountType;
import com.aiverse.spring.modules.authentication.users.enums.Gender;
import com.aiverse.spring.modules.authentication.users.enums.Role;

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
public class SignupResponse {
      private UUID tenantId;
      private String apiKey;
      private String firstName;
      private String lastName;
      private String email;
      private String username;
      private LocalDate dateOfBirth;
      private String phoneNumber;
      private String profilePhoto;
      private String banner;
      private AccountType accountType;
      private Role role;
      private Gender gender;
      private boolean emailVerified;
}
