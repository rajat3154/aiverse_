package com.aiverse.spring.modules.authentication.master.services;

import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.aiverse.spring.modules.authentication.master.dtos.CreateMasterRequest;
import com.aiverse.spring.modules.authentication.master.dtos.MasterResponse;
import com.aiverse.spring.modules.authentication.master.exceptions.MasterAlreadyExistsException;
import com.aiverse.spring.modules.authentication.users.entities.User;
import com.aiverse.spring.modules.authentication.users.enums.AccountType;
import com.aiverse.spring.modules.authentication.users.enums.Role;
import com.aiverse.spring.modules.authentication.users.exceptions.EmailAlreadyExistsException;
import com.aiverse.spring.modules.authentication.users.exceptions.UsernameAlreadyExistsException;
import com.aiverse.spring.modules.authentication.users.repositories.UserRepository;
import com.aiverse.spring.modules.authentication.users.services.ApiKeyService;


@Service
public class MasterService {

      private static final Logger log = LoggerFactory.getLogger(MasterService.class);

      private final UserRepository userRepository;
      private final PasswordEncoder passwordEncoder;
      private final ApiKeyService apiKeyService;
      private final MessageSource messages;

      public MasterService(UserRepository userRepository, PasswordEncoder passwordEncoder, ApiKeyService apiKeyService,
                  MessageSource messages) {
            this.userRepository = userRepository;
            this.passwordEncoder = passwordEncoder;
            this.apiKeyService = apiKeyService;
            this.messages = messages;
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      @Transactional
      public MasterResponse createMaster(CreateMasterRequest request) {
            long startedAt = System.currentTimeMillis();
            log.info(message("master.create.started", request.getEmail()));
            try {
                  if (userRepository.existsByRole(Role.MASTER)) {
                        throw new MasterAlreadyExistsException(message("master.exists"));
                  }
                  if (userRepository.existsByEmailIgnoreCase(request.getEmail().trim())) {
                        throw new EmailAlreadyExistsException(message("auth.signup.email.exists"));
                  }
                  if (userRepository.existsByUsernameIgnoreCase(request.getUsername().trim())) {
                        throw new UsernameAlreadyExistsException(message("auth.signup.username.exists"));
                  }

                  String plainApiKey = apiKeyService.generate();
                  User master = User.builder()
                              .apiKey(apiKeyService.encrypt(plainApiKey))
                              .firstName(request.getFirstName().trim())
                              .lastName(request.getLastName().trim())
                              .email(request.getEmail().trim().toLowerCase())
                              .username(request.getUsername().trim())
                              .password(passwordEncoder.encode(request.getPassword()))
                              .role(Role.MASTER)
                              .accountType(AccountType.GENERAL_USER)
                              .build();
                  User saved = userRepository.save(master);

                  log.info(message("master.create.completed", saved.getTenantId(), System.currentTimeMillis() - startedAt));
                  return toResponse(saved, plainApiKey);
            } catch (RuntimeException exception) {
                  log.error(message("master.create.failed", request.getEmail(), exception.getMessage(),
                              System.currentTimeMillis() - startedAt), exception);
                  throw exception;
            }
      }

      private MasterResponse toResponse(User user, String plainApiKey) {
            return MasterResponse.builder()
                        .tenantId(user.getTenantId())
                        .apiKey(plainApiKey)
                        .firstName(user.getFirstName())
                        .lastName(user.getLastName())
                        .username(user.getUsername())
                        .email(user.getEmail())
                        .role(user.getRole())
                        .enabled(user.isEnabled())
                        .emailVerified(user.isEmailVerified())
                        .createdAt(user.getCreatedAt())
                        .updatedAt(user.getUpdatedAt())
                        .build();
      }
}
