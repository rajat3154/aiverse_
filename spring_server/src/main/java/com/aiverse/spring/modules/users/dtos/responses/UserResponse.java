package com.aiverse.spring.modules.users.dtos.responses;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.aiverse.spring.modules.authentication.users.enums.AccountType;
import com.aiverse.spring.modules.authentication.users.enums.Gender;
import com.aiverse.spring.modules.authentication.users.enums.Role;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Builder
public class UserResponse {
      private UUID tenantId;
      private String firstName;
      private String lastName;
      private String email;
      private String username;
      private LocalDate dateOfBirth;
      private String phoneNumber;
      private String profilePhoto;
      private String banner;
      private String bio;
      private String location;
      private String website;
      private Role role;
      private AccountType accountType;
      private Gender gender;
      private boolean emailVerified;
      private boolean phoneVerified;
      private boolean enabled;
      private Instant createdAt;
      private Instant updatedAt;
}
