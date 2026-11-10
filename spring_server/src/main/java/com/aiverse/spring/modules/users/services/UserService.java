package com.aiverse.spring.modules.users.services;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.aiverse.spring.modules.authentication.users.entities.User;
import com.aiverse.spring.modules.authentication.users.enums.AccountType;
import com.aiverse.spring.modules.authentication.users.enums.Role;
import com.aiverse.spring.modules.authentication.users.exceptions.EmailAlreadyExistsException;
import com.aiverse.spring.modules.authentication.users.exceptions.UsernameAlreadyExistsException;
import com.aiverse.spring.modules.authentication.users.repositories.UserRepository;
import com.aiverse.spring.modules.authentication.users.services.ApiKeyService;
import com.aiverse.spring.modules.users.dtos.requests.CreateUserRequest;
import com.aiverse.spring.modules.users.dtos.requests.UpdateUserRequest;
import com.aiverse.spring.modules.users.dtos.responses.UserResponse;
import com.aiverse.spring.modules.users.exceptions.ProtectedUserException;
import com.aiverse.spring.modules.users.exceptions.UserNotFoundException;


@Service
public class UserService {

      private static final Logger log = LoggerFactory.getLogger(UserService.class);

      private final UserRepository userRepository;
      private final PasswordEncoder passwordEncoder;
      private final ApiKeyService apiKeyService;
      private final MessageSource messages;

      public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder, ApiKeyService apiKeyService,
                  MessageSource messages) {
            this.userRepository = userRepository;
            this.passwordEncoder = passwordEncoder;
            this.apiKeyService = apiKeyService;
            this.messages = messages;
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      @Transactional(readOnly = true)
      public List<UserResponse> getAllUsers() {
            long startedAt = System.currentTimeMillis();
            List<UserResponse> users = userRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt")).stream().map(this::toResponse).toList();
            log.info(message("users.list.completed", users.size(), System.currentTimeMillis() - startedAt));
            return users;
      }

      @Transactional(readOnly = true)
      public UserResponse getUser(UUID tenantId) {
            long startedAt = System.currentTimeMillis();
            try {
                  UserResponse response = toResponse(find(tenantId));
                  log.info(message("users.get.completed", tenantId, System.currentTimeMillis() - startedAt));
                  return response;
            } catch (RuntimeException exception) {
                  logFailure("fetch", tenantId, exception, startedAt);
                  throw exception;
            }
      }

      @Transactional
      public UserResponse createUser(CreateUserRequest request) {
            long startedAt = System.currentTimeMillis();
            Role role = request.getRole() == null ? Role.USER : request.getRole();
            log.info(message("users.create.started", request.getEmail(), role));
            try {
                  if (role == Role.MASTER) {
                        throw new ProtectedUserException(message("users.master.protected"));
                  }
                  String email = request.getEmail().trim().toLowerCase();
                  String username = request.getUsername().trim();
                  if (userRepository.existsByEmailIgnoreCase(email)) {
                        throw new EmailAlreadyExistsException(message("auth.signup.email.exists"));
                  }
                  if (userRepository.existsByUsernameIgnoreCase(username)) {
                        throw new UsernameAlreadyExistsException(message("auth.signup.username.exists"));
                  }

                  User saved = userRepository.save(User.builder()
                              .apiKey(apiKeyService.encrypt(apiKeyService.generate()))
                              .firstName(request.getFirstName().trim())
                              .lastName(request.getLastName().trim())
                              .email(email)
                              .username(username)
                              .dateOfBirth(request.getDateOfBirth())
                              .phoneNumber(request.getPhoneNumber())
                              .password(passwordEncoder.encode(request.getPassword()))
                              .role(role)
                              .accountType(request.getAccountType() == null ? AccountType.GENERAL_USER : request.getAccountType())
                              .gender(request.getGender())
                              .build());
                  log.info(message("users.create.completed", saved.getTenantId(), role, System.currentTimeMillis() - startedAt));
                  return toResponse(saved);
            } catch (RuntimeException exception) {
                  logFailure("creation", request.getEmail(), exception, startedAt);
                  throw exception;
            }
      }

      @Transactional
      public UserResponse updateUser(UUID tenantId, UpdateUserRequest request) {
            long startedAt = System.currentTimeMillis();
            log.info(message("users.update.started", tenantId));
            try {
                  User user = find(tenantId);
                  if (user.getRole() == Role.MASTER) {
                        throw new ProtectedUserException(message("users.master.protected"));
                  }
                  Role previousRole = user.getRole();
                  boolean previouslyEnabled = user.isEnabled();
                  List<String> changed = applyChanges(user, request);
                  User saved = userRepository.save(user);
                  if (saved.getRole() != previousRole) {
                        log.info(message("users.role.changed", tenantId, previousRole, saved.getRole()));
                  }
                  if (saved.isEnabled() != previouslyEnabled) {
                        log.info(message("users.status.changed", tenantId, saved.isEnabled()));
                  }
                  log.info(message("users.update.completed", tenantId, changed.isEmpty() ? "none" : String.join(",", changed),
                              System.currentTimeMillis() - startedAt));
                  return toResponse(saved);
            } catch (RuntimeException exception) {
                  logFailure("update", tenantId, exception, startedAt);
                  throw exception;
            }
      }

      @Transactional
      public void deleteUser(UUID tenantId) {
            long startedAt = System.currentTimeMillis();
            log.info(message("users.delete.started", tenantId));
            try {
                  User user = find(tenantId);
                  if (user.getRole() == Role.MASTER) {
                        throw new ProtectedUserException(message("users.master.protected"));
                  }
                  userRepository.delete(user);
                  log.info(message("users.delete.completed", tenantId, user.getRole(), System.currentTimeMillis() - startedAt));
            } catch (RuntimeException exception) {
                  logFailure("deletion", tenantId, exception, startedAt);
                  throw exception;
            }
      }


      private void logFailure(String action, Object subject, RuntimeException exception, long startedAt) {
            long duration = System.currentTimeMillis() - startedAt;
            if (exception instanceof UserNotFoundException || exception instanceof ProtectedUserException
                        || exception instanceof EmailAlreadyExistsException || exception instanceof UsernameAlreadyExistsException) {
                  log.warn(message("users.rejected", action, subject, exception.getMessage(), duration));
            } else {
                  log.error(message("users.failed", action, subject, exception.getMessage(), duration), exception);
            }
      }

      private User find(UUID tenantId) {
            return userRepository.findById(tenantId)
                        .orElseThrow(() -> new UserNotFoundException(message("users.not.found", tenantId)));
      }

      private List<String> applyChanges(User user, UpdateUserRequest request) {
            if (request.getRole() == Role.MASTER) {
                  throw new ProtectedUserException(message("users.master.protected"));
            }
            List<String> changed = new ArrayList<>();
            if (request.getEmail() != null) {
                  String email = request.getEmail().trim().toLowerCase();
                  if (!email.equalsIgnoreCase(user.getEmail()) && userRepository.existsByEmailIgnoreCase(email)) {
                        throw new EmailAlreadyExistsException(message("auth.signup.email.exists"));
                  }
                  user.setEmail(email);
                  changed.add("email");
            }
            if (request.getUsername() != null) {
                  String username = request.getUsername().trim();
                  if (!username.equalsIgnoreCase(user.getUsername()) && userRepository.existsByUsernameIgnoreCase(username)) {
                        throw new UsernameAlreadyExistsException(message("auth.signup.username.exists"));
                  }
                  user.setUsername(username);
                  changed.add("username");
            }
            if (request.getFirstName() != null) { user.setFirstName(request.getFirstName().trim()); changed.add("firstName"); }
            if (request.getLastName() != null) { user.setLastName(request.getLastName().trim()); changed.add("lastName"); }
            if (request.getDateOfBirth() != null) { user.setDateOfBirth(request.getDateOfBirth()); changed.add("dateOfBirth"); }
            if (request.getPhoneNumber() != null) { user.setPhoneNumber(request.getPhoneNumber()); changed.add("phoneNumber"); }
            if (request.getBio() != null) { user.setBio(request.getBio()); changed.add("bio"); }
            if (request.getLocation() != null) { user.setLocation(request.getLocation()); changed.add("location"); }
            if (request.getWebsite() != null) { user.setWebsite(request.getWebsite()); changed.add("website"); }
            if (request.getRole() != null) { user.setRole(request.getRole()); changed.add("role"); }
            if (request.getAccountType() != null) { user.setAccountType(request.getAccountType()); changed.add("accountType"); }
            if (request.getGender() != null) { user.setGender(request.getGender()); changed.add("gender"); }
            if (request.getEnabled() != null) { user.setEnabled(request.getEnabled()); changed.add("enabled"); }
            return changed;
      }

      private UserResponse toResponse(User user) {
            return UserResponse.builder()
                        .tenantId(user.getTenantId())
                        .firstName(user.getFirstName())
                        .lastName(user.getLastName())
                        .email(user.getEmail())
                        .username(user.getUsername())
                        .dateOfBirth(user.getDateOfBirth())
                        .phoneNumber(user.getPhoneNumber())
                        .profilePhoto(user.getProfilePhoto())
                        .banner(user.getBanner())
                        .bio(user.getBio())
                        .location(user.getLocation())
                        .website(user.getWebsite())
                        .role(user.getRole())
                        .accountType(user.getAccountType())
                        .gender(user.getGender())
                        .emailVerified(user.isEmailVerified())
                        .phoneVerified(user.isPhoneVerified())
                        .enabled(user.isEnabled())
                        .createdAt(user.getCreatedAt())
                        .updatedAt(user.getUpdatedAt())
                        .build();
      }
}
