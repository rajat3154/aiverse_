package com.aiverse.spring.modules.authentication.users.services;

import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.aiverse.spring.modules.authentication.users.dtos.requests.SignupRequest;
import com.aiverse.spring.modules.authentication.users.dtos.responses.SignupResponse;
import com.aiverse.spring.modules.authentication.users.entities.User;
import com.aiverse.spring.modules.authentication.users.enums.Role;
import com.aiverse.spring.modules.authentication.users.exceptions.EmailAlreadyExistsException;
import com.aiverse.spring.modules.authentication.users.exceptions.PasswordMismatchException;
import com.aiverse.spring.modules.authentication.users.exceptions.UsernameAlreadyExistsException;
import com.aiverse.spring.modules.authentication.users.repositories.UserRepository;

@Service
public class AuthenticationService {

      private static final Logger log = LoggerFactory.getLogger(AuthenticationService.class);

      private final UserRepository userRepository;
      private final PasswordEncoder passwordEncoder;
      private final ApiKeyService apiKeyService;
      private final MessageSource messages;

      public AuthenticationService(UserRepository userRepository, PasswordEncoder passwordEncoder,
                  ApiKeyService apiKeyService, MessageSource messages) {
            this.userRepository = userRepository;
            this.passwordEncoder = passwordEncoder;
            this.apiKeyService = apiKeyService;
            this.messages = messages;
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      @Transactional
      public SignupResponse signup(SignupRequest request) {
            long startedAt = System.currentTimeMillis();
            log.info(message("auth.signup.started", request.getEmail()));
            try {
                  if (!request.getPassword().equals(request.getConfirmPassword())) {
                        throw new PasswordMismatchException(message("auth.signup.password.mismatch"));
                  }
                  if (userRepository.existsByEmailIgnoreCase(request.getEmail().trim())) {
                        throw new EmailAlreadyExistsException(message("auth.signup.email.exists"));
                  }
                  if (userRepository.existsByUsernameIgnoreCase(request.getUsername().trim())) {
                        throw new UsernameAlreadyExistsException(message("auth.signup.username.exists"));
                  }

                  String plainApiKey = apiKeyService.generate();
                  User user = User.builder()
                              .apiKey(apiKeyService.encrypt(plainApiKey))
                              .firstName(request.getFirstName().trim())
                              .lastName(request.getLastName().trim())
                              .email(request.getEmail().trim().toLowerCase())
                              .username(request.getUsername().trim())
                              .dateOfBirth(request.getDateOfBirth())
                              .phoneNumber(request.getPhoneNumber())
                              .profilePhoto(request.getProfilePhoto())
                              .banner(request.getBanner())
                              .password(passwordEncoder.encode(request.getPassword()))
                              .role(Role.USER)
                              .accountType(request.getAccountType())
                              .gender(request.getGender())
                              .build();
                  User savedUser = userRepository.save(user);
                  log.info(message("auth.signup.completed", savedUser.getTenantId(), System.currentTimeMillis() - startedAt));
                  return mapToSignupResponse(savedUser, plainApiKey);
            } catch (RuntimeException exception) {
                  log.error(message("auth.signup.failed", request.getEmail(), exception.getMessage(),
                              System.currentTimeMillis() - startedAt), exception);
                  throw exception;
            }
      }

      private SignupResponse mapToSignupResponse(User user, String plainApiKey) {
            return SignupResponse.builder()
                        .tenantId(user.getTenantId())
                        .apiKey(plainApiKey)
                        .firstName(user.getFirstName())
                        .lastName(user.getLastName())
                        .email(user.getEmail())
                        .username(user.getUsername())
                        .dateOfBirth(user.getDateOfBirth())
                        .phoneNumber(user.getPhoneNumber())
                        .profilePhoto(user.getProfilePhoto())
                        .banner(user.getBanner())
                        .accountType(user.getAccountType())
                        .role(user.getRole())
                        .gender(user.getGender())
                        .emailVerified(user.isEmailVerified())
                        .build();
      }
}
