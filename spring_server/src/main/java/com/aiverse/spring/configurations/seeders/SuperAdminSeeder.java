package com.aiverse.spring.configurations.seeders;

import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.MessageSource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import com.aiverse.spring.modules.authentication.users.entities.User;
import com.aiverse.spring.modules.authentication.users.enums.AccountType;
import com.aiverse.spring.modules.authentication.users.enums.Role;
import com.aiverse.spring.modules.authentication.users.repositories.UserRepository;
import com.aiverse.spring.modules.authentication.users.services.ApiKeyService;

@Component
public class SuperAdminSeeder implements CommandLineRunner {

      private static final Logger log = LoggerFactory.getLogger(SuperAdminSeeder.class);

      private final UserRepository userRepository;
      private final PasswordEncoder passwordEncoder;
      private final ApiKeyService apiKeyService;
      private final MessageSource messages;

      private final String firstName;
      private final String lastName;
      private final String email;
      private final String username;
      private final String password;

      public SuperAdminSeeder(UserRepository userRepository, PasswordEncoder passwordEncoder, ApiKeyService apiKeyService,
                  MessageSource messages,
                  @Value("${aiverse.master.seed-first-name:}") String firstName,
                  @Value("${aiverse.master.seed-last-name:}") String lastName,
                  @Value("${aiverse.master.seed-email:}") String email,
                  @Value("${aiverse.master.seed-username:}") String username,
                  @Value("${aiverse.master.seed-password:}") String password) {
            this.userRepository = userRepository;
            this.passwordEncoder = passwordEncoder;
            this.apiKeyService = apiKeyService;
            this.messages = messages;
            this.firstName = firstName;
            this.lastName = lastName;
            this.email = email;
            this.username = username;
            this.password = password;
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      @Override
      public void run(String... args) {
            if (email.isBlank() || username.isBlank() || password.isBlank() || firstName.isBlank() || lastName.isBlank()) {
                  log.info(message("master.seed.not.configured"));
                  return;
            }
            String normalizedEmail = email.trim().toLowerCase();
            if (userRepository.existsByRole(Role.MASTER) || userRepository.existsByEmailIgnoreCase(normalizedEmail)
                        || userRepository.existsByUsernameIgnoreCase(username.trim())) {
                  log.info(message("master.seed.exists", normalizedEmail));
                  return;
            }

            User master = User.builder()
                        .apiKey(apiKeyService.encrypt(apiKeyService.generate()))
                        .firstName(firstName.trim())
                        .lastName(lastName.trim())
                        .email(normalizedEmail)
                        .username(username.trim())
                        .password(passwordEncoder.encode(password))
                        .role(Role.MASTER)
                        .accountType(AccountType.GENERAL_USER)
                        .emailVerified(true)
                        .build();
            User saved = userRepository.save(master);
            log.info(message("master.seed.created", saved.getTenantId(), normalizedEmail));
      }
}
