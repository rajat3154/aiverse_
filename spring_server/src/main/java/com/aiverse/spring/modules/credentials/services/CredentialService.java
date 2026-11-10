package com.aiverse.spring.modules.credentials.services;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.aiverse.spring.modules.credentials.dtos.requests.CreateCredentialRequest;
import com.aiverse.spring.modules.credentials.dtos.requests.UpdateCredentialRequest;
import com.aiverse.spring.modules.credentials.dtos.responses.CredentialResponse;
import com.aiverse.spring.modules.credentials.entities.Credential;
import com.aiverse.spring.modules.credentials.enums.CredentialStatus;
import com.aiverse.spring.modules.credentials.enums.CredentialStorageType;
import com.aiverse.spring.modules.credentials.exceptions.CredentialAlreadyExistsException;
import com.aiverse.spring.modules.credentials.exceptions.CredentialNotFoundException;
import com.aiverse.spring.modules.credentials.repositories.CredentialRepository;

@Service
public class CredentialService {

      private static final Logger log = LoggerFactory.getLogger(CredentialService.class);

      private final CredentialRepository credentialRepository;
      private final CredentialEncryptionService encryptionService;
      private final MessageSource messages;

      public CredentialService(CredentialRepository credentialRepository, CredentialEncryptionService encryptionService,MessageSource messages) {
            this.credentialRepository = credentialRepository;
            this.encryptionService = encryptionService;
            this.messages = messages;
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      @Transactional(readOnly = true)
      public List<CredentialResponse> getAll(UUID userId) {
            long startedAt = System.currentTimeMillis();
            try {
                  List<CredentialResponse> credentials = credentialRepository.findAllByUserIdOrderByCreatedAtDesc(userId).stream().map(this::toResponse).toList();
                  log.info(message("credentials.list.completed", userId, credentials.size(), System.currentTimeMillis() - startedAt));
                  return credentials;
            } catch (RuntimeException exception) {
                  logFailure("listing", userId, userId, exception, startedAt);
                  throw exception;
            }
      }

      @Transactional(readOnly = true)
      public CredentialResponse getById(UUID userId, UUID credentialId) {
            long startedAt = System.currentTimeMillis();
            try {
                  CredentialResponse response = toResponse(find(userId, credentialId));
                  log.info(message("credentials.get.completed", userId, credentialId, System.currentTimeMillis() - startedAt));
                  return response;
            } catch (RuntimeException exception) {
                  logFailure("fetch", userId, credentialId, exception, startedAt);
                  throw exception;
            }
      }

      @Transactional
      public CredentialResponse create(UUID userId, CreateCredentialRequest request) {
            long startedAt = System.currentTimeMillis();
            String name = request.name().trim();
            log.info(message("credentials.create.started", userId, request.type(), request.identifier()));
            try {
                  if (credentialRepository.existsByUserIdAndNameIgnoreCase(userId, name)) {
                        throw new CredentialAlreadyExistsException(message("credentials.name.exists"));
                  }
                  Credential saved = credentialRepository.save(Credential.builder()
                              .userId(userId)
                              .name(name)
                              .type(request.type())
                              .provider(blankToNull(request.provider()))
                              .identifier(request.identifier())
                              .secret(encryptionService.encrypt(request.secret()))
                              .storageType(CredentialStorageType.ENCRYPTED)
                              .metadata(request.metadata())
                              .status(CredentialStatus.ACTIVE)
                              .build());
                  log.info(message("credentials.create.completed", userId, saved.getId(), System.currentTimeMillis() - startedAt));
                  return toResponse(saved);
            } catch (RuntimeException exception) {
                  logFailure("creation", userId, name, exception, startedAt);
                  throw exception;
            }
      }

      @Transactional
      public CredentialResponse update(UUID userId, UUID credentialId, UpdateCredentialRequest request) {
            long startedAt = System.currentTimeMillis();
            log.info(message("credentials.update.started", userId, credentialId));
            try {
                  Credential credential = find(userId, credentialId);
                  String name = request.name().trim();
                  if (!name.equalsIgnoreCase(credential.getName()) && credentialRepository.existsByUserIdAndNameIgnoreCase(userId, name)) {
                        throw new CredentialAlreadyExistsException(message("credentials.name.exists"));
                  }
                  boolean secretChanged = request.secret() != null && !request.secret().isBlank();
                  CredentialStatus previousStatus = credential.getStatus();

                  credential.setName(name);
                  credential.setProvider(blankToNull(request.provider()));
                  credential.setIdentifier(request.identifier());
                  credential.setMetadata(request.metadata());
                  if (request.status() != null) {
                        credential.setStatus(request.status());
                  }
                  if (secretChanged) {
                        credential.setSecret(encryptionService.encrypt(request.secret()));
                  }
                  Credential saved = credentialRepository.save(credential);
                  if (secretChanged) {
                        log.info(message("credentials.secret.rotated", userId, credentialId));
                  }
                  if (saved.getStatus() != previousStatus) {
                        log.info(message("credentials.status.changed", userId, credentialId, previousStatus, saved.getStatus()));
                  }
                  log.info(message("credentials.update.completed", userId, credentialId, System.currentTimeMillis() - startedAt));
                  return toResponse(saved);
            } catch (RuntimeException exception) {
                  logFailure("update", userId, credentialId, exception, startedAt);
                  throw exception;
            }
      }

      @Transactional
      public void delete(UUID userId, UUID credentialId) {
            long startedAt = System.currentTimeMillis();
            log.info(message("credentials.delete.started", userId, credentialId));
            try {
                  credentialRepository.delete(find(userId, credentialId));
                  log.info(message("credentials.delete.completed", userId, credentialId, System.currentTimeMillis() - startedAt));
            } catch (RuntimeException exception) {
                  logFailure("deletion", userId, credentialId, exception, startedAt);
                  throw exception;
            }
      }

      @Transactional
      public String getSecret(UUID userId, UUID credentialId) {
            long startedAt = System.currentTimeMillis();
            try {
                  Credential credential = find(userId, credentialId);
                  if (credential.getStatus() != CredentialStatus.ACTIVE) {
                        throw new IllegalStateException(message("credentials.not.active"));
                  }
                  if (credential.getStorageType() != CredentialStorageType.ENCRYPTED) {
                        throw new IllegalStateException(message("credentials.hashed.unreadable"));
                  }
                  String secret = encryptionService.decrypt(credential.getSecret());
                  credential.setLastUsedAt(Instant.now());
                  log.info(message("credentials.secret.used", userId, credentialId, System.currentTimeMillis() - startedAt));
                  return secret;
            } catch (RuntimeException exception) {
                  logFailure("secret read", userId, credentialId, exception, startedAt);
                  throw exception;
            }
      }

      private void logFailure(String action, UUID userId, Object subject, RuntimeException exception, long startedAt) {
            long duration = System.currentTimeMillis() - startedAt;
            if (exception instanceof CredentialNotFoundException || exception instanceof CredentialAlreadyExistsException || exception instanceof IllegalStateException) {
                  log.warn(message("credentials.rejected", action, userId, subject, exception.getMessage(), duration));
            } else {
                  log.error(message("credentials.failed", action, userId, subject, exception.getMessage(), duration), exception);
            }
      }

      private Credential find(UUID userId, UUID credentialId) {
            return credentialRepository.findByIdAndUserId(credentialId, userId).orElseThrow(() -> new CredentialNotFoundException(message("credentials.not.found", credentialId)));
      }

      private static String blankToNull(String value) {
            return value == null || value.isBlank() ? null : value.trim();
      }

      private CredentialResponse toResponse(Credential credential) {
            return new CredentialResponse(
                        credential.getId(),
                        credential.getName(),
                        credential.getType(),
                        credential.getProvider(),
                        credential.getIdentifier(),
                        credential.getStorageType(),
                        credential.getMetadata(),
                        credential.getStatus(),
                        credential.getCreatedAt(),
                        credential.getUpdatedAt(),
                        credential.getLastUsedAt());
      }
}
