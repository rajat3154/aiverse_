package com.aiverse.spring.modules.llm_providers.services;

import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import com.aiverse.spring.modules.credentials.exceptions.CredentialNotFoundException;
import com.aiverse.spring.modules.credentials.services.CredentialService;
import com.aiverse.spring.modules.llm_providers.dtos.requests.ProviderChatRequest;
import com.aiverse.spring.modules.llm_providers.dtos.requests.ProviderConfigurationRequest;
import com.aiverse.spring.modules.llm_providers.dtos.responses.ProviderChatResponse;
import com.aiverse.spring.modules.llm_providers.dtos.responses.ProviderConfigurationResponse;
import com.aiverse.spring.modules.llm_providers.entities.LLMProviderCatalog;
import com.aiverse.spring.modules.llm_providers.entities.LLMProviderConfiguration;
import com.aiverse.spring.modules.llm_providers.exceptions.LLMProviderException;
import com.aiverse.spring.modules.llm_providers.repositories.LLMProviderCatalogRepository;
import com.aiverse.spring.modules.llm_providers.repositories.LLMProviderConfigurationRepository;

@Service
public class LLMProviderConfigurationService {

      private static final Logger log = LoggerFactory.getLogger(LLMProviderConfigurationService.class);
      private static final Set<String> ROLES = Set.of("system", "user", "assistant");
      private static final int MAX_MESSAGES = 50;
      private static final int MAX_MESSAGE_LENGTH = 20_000;
      private static final ParameterizedTypeReference<Map<String, Object>> JSON_OBJECT = new ParameterizedTypeReference<>() {
      };

      private final LLMProviderConfigurationRepository repository;
      private final LLMProviderCatalogRepository catalogRepository;
      private final CredentialService credentialService;
      private final RestClient aiClient;
      private final String aiServerUrl;
      private final String aiInternalToken;
      private final MessageSource messages;

      public LLMProviderConfigurationService(LLMProviderConfigurationRepository repository, LLMProviderCatalogRepository catalogRepository,
                  CredentialService credentialService, @Value("${aiverse.ai.server-url:http://localhost:8000}") String aiServerUrl,
                  @Value("${aiverse.ai.internal-token:}") String aiInternalToken, MessageSource messages) {
            this.messages = messages;
            this.repository = repository;
            this.catalogRepository = catalogRepository;
            this.credentialService = credentialService;
            this.aiServerUrl = aiServerUrl.endsWith("/") ? aiServerUrl.substring(0, aiServerUrl.length() - 1) : aiServerUrl;
            this.aiInternalToken = aiInternalToken;
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(Duration.ofSeconds(5));
            factory.setReadTimeout(Duration.ofSeconds(120));
            this.aiClient = RestClient.builder().requestFactory(factory).build();
      }

      @Transactional(readOnly = true)
      public List<ProviderConfigurationResponse> list(UUID userId, UUID providerId) {
            return logged("list", userId, providerId, () -> {
                  provider(providerId);
                  return repository.findAllByUserIdAndProviderIdOrderByCreatedAtAsc(userId, providerId).stream().map(this::toResponse).toList();
            }, List::size);
      }

      @Transactional
      public ProviderConfigurationResponse create(UUID userId, UUID providerId, ProviderConfigurationRequest request) {
            return logged("create", userId, providerId, () -> doCreate(userId, providerId, request), ProviderConfigurationResponse::id);
      }

      private ProviderConfigurationResponse doCreate(UUID userId, UUID providerId, ProviderConfigurationRequest request) {
            provider(providerId);
            String name = validName(request.name());
            if (repository.existsByUserIdAndProviderIdAndNameIgnoreCase(userId, providerId, name)) {
                  throw new LLMProviderException(HttpStatus.CONFLICT, "You already have a configuration named \"" + name + "\" for this provider.");
            }
            checkCredential(userId, request.credentialId());

            LLMProviderConfiguration entity = new LLMProviderConfiguration();
            entity.setUserId(userId);
            entity.setProviderId(providerId);
            apply(entity, name, request);
            boolean makeActive = Boolean.TRUE.equals(request.active()) || repository.countByUserIdAndProviderId(userId, providerId) == 0;
            if (makeActive) {
                  deactivateCurrent(userId, providerId);
            }
            entity.setActive(makeActive);
            return toResponse(repository.save(entity));
      }

      @Transactional
      public ProviderConfigurationResponse update(UUID userId, UUID providerId, UUID id, ProviderConfigurationRequest request) {
            return logged("update", userId, providerId, () -> doUpdate(userId, providerId, id, request), ProviderConfigurationResponse::id);
      }

      private ProviderConfigurationResponse doUpdate(UUID userId, UUID providerId, UUID id, ProviderConfigurationRequest request) {
            LLMProviderConfiguration entity = find(userId, providerId, id);
            String name = validName(request.name());
            if (repository.existsByUserIdAndProviderIdAndNameIgnoreCaseAndIdNot(userId, providerId, name, id)) {
                  throw new LLMProviderException(HttpStatus.CONFLICT, "You already have a configuration named \"" + name + "\" for this provider.");
            }
            checkCredential(userId, request.credentialId());
            apply(entity, name, request);
            if (Boolean.TRUE.equals(request.active()) && !entity.isActive()) {
                  deactivateCurrent(userId, providerId);
                  entity.setActive(true);
            }
            return toResponse(repository.save(entity));
      }

      @Transactional
      public ProviderConfigurationResponse activate(UUID userId, UUID providerId, UUID id) {
            return logged("activate", userId, providerId, () -> doActivate(userId, providerId, id), ProviderConfigurationResponse::id);
      }

      private ProviderConfigurationResponse doActivate(UUID userId, UUID providerId, UUID id) {
            LLMProviderConfiguration entity = find(userId, providerId, id);
            if (!entity.isActive()) {
                  deactivateCurrent(userId, providerId);
                  entity.setActive(true);
                  repository.save(entity);
            }
            return toResponse(entity);
      }

      @Transactional
      public void delete(UUID userId, UUID providerId, UUID id) {
            logged("delete", userId, providerId, () -> {
                  repository.delete(find(userId, providerId, id));
                  return id;
            }, Function.identity());
      }

      public ProviderChatResponse chat(UUID userId, UUID providerId, UUID id, ProviderChatRequest request) {
            long startedAt = System.currentTimeMillis();
            int count = request == null || request.messages() == null ? 0 : request.messages().size();
            log.info(message("llm.chat.started", userId, providerId, id, count));
            try {
                  ProviderChatResponse response = doChat(userId, providerId, id, request);
                  Object tokens = response.usage() == null ? null : response.usage().get("total_tokens");
                  log.info(message("llm.chat.completed", userId, providerId, id, response.model(), response.finishReason(), tokens, System.currentTimeMillis() - startedAt));
                  return response;
            } catch (LLMProviderException exception) {
                  log.warn(message("llm.chat.rejected", userId, providerId, id, exception.getStatus().value(), exception.getMessage(), System.currentTimeMillis() - startedAt));
                  throw exception;
            } catch (RuntimeException exception) {
                  log.error(message("llm.chat.failed", userId, providerId, id, exception.getClass().getSimpleName() + ": " + exception.getMessage(), System.currentTimeMillis() - startedAt), exception);
                  throw exception;
            }
      }

      private ProviderChatResponse doChat(UUID userId, UUID providerId, UUID id, ProviderChatRequest request) {
            LLMProviderCatalog provider = provider(providerId);
            LLMProviderConfiguration configuration = find(userId, providerId, id);
            List<Map<String, String>> messages = validMessages(request);

            if (configuration.getModel() == null || configuration.getModel().isBlank()) {
                  throw new LLMProviderException(HttpStatus.BAD_REQUEST, "Choose a model in this configuration first.");
            }
            Map<String, Object> credential = new LinkedHashMap<>();
            if (configuration.getCredentialId() != null) {
                  try {
                        credential.put("api_key", credentialService.getSecret(userId, configuration.getCredentialId()).strip());
                  } catch (CredentialNotFoundException exception) {
                        throw new LLMProviderException(HttpStatus.BAD_REQUEST, "The credential of this configuration no longer exists. Pick another one.");
                  } catch (IllegalStateException exception) {
                        throw new LLMProviderException(HttpStatus.BAD_REQUEST, "The credential of this configuration is not active.");
                  }
            } else if (requiresCredential(provider)) {
                  throw new LLMProviderException(HttpStatus.BAD_REQUEST, "Pick an API key in this configuration first.");
            }
            if (aiInternalToken == null || aiInternalToken.isBlank()) {
                  throw new LLMProviderException(HttpStatus.SERVICE_UNAVAILABLE, "The AI server link is not configured (AI_INTERNAL_TOKEN).");
            }

            Map<String, Object> body = new LinkedHashMap<>();
            body.put("provider_key", provider.getProviderKey());
            body.put("model", configuration.getModel());
            body.put("messages", messages);
            body.put("configuration", configuration.getConfiguration() == null ? Map.of() : configuration.getConfiguration());
            body.put("parameters", configuration.getParameters() == null ? Map.of() : configuration.getParameters());
            body.put("credential", credential);
            body.put("user_id", userId.toString());

            Map<String, Object> response;
            try {
                  response = aiClient.post()
                              .uri(URI.create(aiServerUrl + "/internal/llm/chat"))
                              .header("X-Internal-Token", aiInternalToken)
                              .contentType(MediaType.APPLICATION_JSON)
                              .body(body)
                              .retrieve()
                              .body(JSON_OBJECT);
            } catch (RestClientResponseException exception) {
                  String reason = LLMProviderModelService.providerMessage(exception.getResponseBodyAsString());
                  throw new LLMProviderException(HttpStatus.BAD_GATEWAY, reason != null ? reason : "The AI server could not generate a response (HTTP " + exception.getStatusCode().value() + ").");
            } catch (RuntimeException exception) {
                  throw new LLMProviderException(HttpStatus.BAD_GATEWAY, "Unable to reach the AI server.");
            }
            if (response == null || !(response.get("content") instanceof String content)) {
                  throw new LLMProviderException(HttpStatus.BAD_GATEWAY, "The AI server returned no response.");
            }
            return new ProviderChatResponse(content, configuration.getModel(), provider.getName(), asMap(response.get("usage")),
                        response.get("finish_reason") instanceof String reason ? reason : null);
      }

      // ---------------------------------------------------------------- helpers

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      /** Runs one configuration action and logs its outcome with the duration: completed, rejected (user error) or failed. */
      private <T> T logged(String action, UUID userId, UUID providerId, Supplier<T> body, Function<T, Object> subject) {
            long startedAt = System.currentTimeMillis();
            try {
                  T result = body.get();
                  log.info(message("llm.configuration.completed", action, userId, providerId, subject.apply(result), System.currentTimeMillis() - startedAt));
                  return result;
            } catch (LLMProviderException exception) {
                  log.warn(message("llm.configuration.rejected", action, userId, providerId, exception.getMessage(), System.currentTimeMillis() - startedAt));
                  throw exception;
            } catch (RuntimeException exception) {
                  log.error(message("llm.configuration.failed", action, userId, providerId, exception.getClass().getSimpleName() + ": " + exception.getMessage(),
                              System.currentTimeMillis() - startedAt), exception);
                  throw exception;
            }
      }

      private void deactivateCurrent(UUID userId, UUID providerId) {
            repository.findByUserIdAndProviderIdAndActiveTrue(userId, providerId).ifPresent(current -> {
                  current.setActive(false);
                  repository.saveAndFlush(current);
            });
      }

      private void apply(LLMProviderConfiguration entity, String name, ProviderConfigurationRequest request) {
            entity.setName(name);
            entity.setCredentialId(request.credentialId());
            String model = request.model() == null ? null : request.model().strip();
            if (model != null && model.length() > 255) {
                  throw new LLMProviderException(HttpStatus.BAD_REQUEST, "The model name is too long.");
            }
            entity.setModel(model == null || model.isEmpty() ? null : model);
            entity.setConfiguration(request.configuration() == null ? Map.of() : request.configuration());
            entity.setParameters(request.parameters() == null ? Map.of() : request.parameters());
      }

      private static String validName(String value) {
            String name = value == null ? "" : value.strip();
            if (name.isEmpty()) {
                  throw new LLMProviderException(HttpStatus.BAD_REQUEST, "Give the configuration a name.");
            }
            if (name.length() > 150) {
                  throw new LLMProviderException(HttpStatus.BAD_REQUEST, "The configuration name must be 150 characters or fewer.");
            }
            return name;
      }

      private void checkCredential(UUID userId, UUID credentialId) {
            if (credentialId == null) {
                  return;
            }
            try {
                  credentialService.getById(userId, credentialId);
            } catch (CredentialNotFoundException exception) {
                  throw new LLMProviderException(HttpStatus.BAD_REQUEST, "That credential was not found.");
            }
      }

      private static List<Map<String, String>> validMessages(ProviderChatRequest request) {
            if (request == null || request.messages() == null || request.messages().isEmpty()) {
                  throw new LLMProviderException(HttpStatus.BAD_REQUEST, "Send at least one message.");
            }
            if (request.messages().size() > MAX_MESSAGES) {
                  throw new LLMProviderException(HttpStatus.BAD_REQUEST, "Too many messages in one conversation. Clear the chat and start again.");
            }
            List<Map<String, String>> messages = new ArrayList<>();
            for (ProviderChatRequest.Message message : request.messages()) {
                  if (message == null || message.role() == null || !ROLES.contains(message.role())) {
                        throw new LLMProviderException(HttpStatus.BAD_REQUEST, "Each message needs a role of system, user or assistant.");
                  }
                  String content = message.content() == null ? "" : message.content();
                  if (content.isBlank() || content.length() > MAX_MESSAGE_LENGTH) {
                        throw new LLMProviderException(HttpStatus.BAD_REQUEST, "Messages must be 1 to " + MAX_MESSAGE_LENGTH + " characters.");
                  }
                  messages.add(Map.of("role", message.role(), "content", content));
            }
            if (!"user".equals(messages.get(messages.size() - 1).get("role"))) {
                  throw new LLMProviderException(HttpStatus.BAD_REQUEST, "The last message must be from the user.");
            }
            return messages;
      }

      private static boolean requiresCredential(LLMProviderCatalog provider) {
            Map<String, Object> manifest = asMap(provider.getManifest());
            return !Boolean.FALSE.equals(asMap(manifest.get("credentials")).get("required"));
      }

      private LLMProviderCatalog provider(UUID providerId) {
            return catalogRepository.findById(providerId).orElseThrow(() -> new LLMProviderException(HttpStatus.NOT_FOUND, "Provider not found."));
      }

      private LLMProviderConfiguration find(UUID userId, UUID providerId, UUID id) {
            return repository.findByIdAndUserIdAndProviderId(id, userId, providerId)
                        .orElseThrow(() -> new LLMProviderException(HttpStatus.NOT_FOUND, "Configuration not found."));
      }

      private ProviderConfigurationResponse toResponse(LLMProviderConfiguration entity) {
            return new ProviderConfigurationResponse(entity.getId(), entity.getProviderId(), entity.getName(), entity.getCredentialId(), entity.getModel(),
                        entity.getConfiguration() == null ? Map.of() : entity.getConfiguration(),
                        entity.getParameters() == null ? Map.of() : entity.getParameters(), entity.isActive(), entity.getCreatedAt(), entity.getUpdatedAt());
      }

      @SuppressWarnings("unchecked")
      private static Map<String, Object> asMap(Object value) {
            return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
      }
}
