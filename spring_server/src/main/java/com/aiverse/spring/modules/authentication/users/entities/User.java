package com.aiverse.spring.modules.authentication.users.entities;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.aiverse.spring.modules.authentication.users.enums.AccountType;
import com.aiverse.spring.modules.authentication.users.enums.Gender;
import com.aiverse.spring.modules.authentication.users.enums.Role;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "users", uniqueConstraints = {
            @UniqueConstraint(name = "uk_user_email", columnNames = "email"),
            @UniqueConstraint(name = "uk_user_username", columnNames = "username") })
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

      @Id
      @GeneratedValue(strategy = GenerationType.UUID)
      @Column(name = "tenant_id")
      private UUID tenantId;

      @Column(name = "api_key", nullable = false, length = 500)
      private String apiKey;

      @Column(name = "first_name", nullable = false, length = 100)
      private String firstName;

      @Column(name = "last_name", nullable = false, length = 100)
      private String lastName;

      @Column(nullable = false, length = 255)
      private String email;

      @Column(nullable = false, length = 50)
      private String username;

      @Column(name = "date_of_birth")
      private LocalDate dateOfBirth;

      @Column(name = "phone_number", length = 20)
      private String phoneNumber;

      @Column(name = "profile_photo", length = 1000)
      private String profilePhoto;

      @Column(name = "banner", length = 1000)
      private String banner;

      @Column(length = 500)
      private String bio;

      @Column(length = 150)
      private String location;

      @Column(length = 255)
      private String website;

      @Column(length = 255)
      private String password;

      @Enumerated(EnumType.STRING)
      @Column(nullable = false, length = 30)
      @Builder.Default
      private Role role = Role.USER;

      @Enumerated(EnumType.STRING)
      @Column(name = "account_type", nullable = false, length = 30)
      @Builder.Default
      private AccountType accountType = AccountType.GENERAL_USER;

      @Enumerated(EnumType.STRING)
      @Column(length = 30)
      private Gender gender;

      @Column(name = "email_verified", nullable = false)
      @Builder.Default
      private boolean emailVerified = false;

      @Column(name = "phone_verified", nullable = false)
      @Builder.Default
      private boolean phoneVerified = false;

      @Column(nullable = false)
      @Builder.Default
      private boolean enabled = true;

      @Column(name = "created_at", nullable = false, updatable = false)
      @Builder.Default
      private Instant createdAt = Instant.now();

      @Column(name = "updated_at", nullable = false)
      @Builder.Default
      private Instant updatedAt = Instant.now();

      @PreUpdate
      protected void onUpdate() {
            updatedAt = Instant.now();
      }
}
