package com.aiverse.spring.modules.llm_providers.services;

import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Locale;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import com.aiverse.spring.modules.credentials.exceptions.CredentialNotFoundException;
import com.aiverse.spring.modules.credentials.services.CredentialService;
import com.aiverse.spring.modules.llm_providers.dtos.responses.ProviderModelResponse;
import com.aiverse.spring.modules.llm_providers.entities.LLMProviderCatalog;
import com.aiverse.spring.modules.llm_providers.exceptions.LLMProviderException;
import com.aiverse.spring.modules.llm_providers.repositories.LLMProviderCatalogRepository;


@Service
public class LLMProviderModelService {

      private static final Logger log = LoggerFactory.getLogger(LLMProviderModelService.class);
      private static final ParameterizedTypeReference<Map<String, Object>> JSON_OBJECT = new ParameterizedTypeReference<>() {
      };

      private final LLMProviderCatalogRepository repository;
      private final CredentialService credentialService;
      private final RestClient client;
      private final MessageSource messages;

      public LLMProviderModelService(LLMProviderCatalogRepository repository, CredentialService credentialService, MessageSource messages) {
            this.messages = messages;
            this.repository = repository;
            this.credentialService = credentialService;
            SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(Duration.ofSeconds(5));
            factory.setReadTimeout(Duration.ofSeconds(15));
            this.client = RestClient.builder().requestFactory(factory).build();
      }

      public List<ProviderModelResponse> listModels(UUID userId, UUID providerId, UUID credentialId) {
            long startedAt = System.currentTimeMillis();
            try {
                  List<ProviderModelResponse> models = fetchModels(userId, providerId, credentialId);
                  log.info(message("llm.models.completed", userId, providerId, credentialId, models.size(), System.currentTimeMillis() - startedAt));
                  return models;
            } catch (LLMProviderException exception) {
                  log.warn(message("llm.models.rejected", userId, providerId, credentialId, exception.getStatus().value(), exception.getMessage(), System.currentTimeMillis() - startedAt));
                  throw exception;
            } catch (RuntimeException exception) {
                  log.error(message("llm.models.failed", userId, providerId, credentialId, exception.getClass().getSimpleName() + ": " + exception.getMessage(), System.currentTimeMillis() - startedAt), exception);
                  throw exception;
            }
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      private List<ProviderModelResponse> fetchModels(UUID userId, UUID providerId, UUID credentialId) {
            LLMProviderCatalog provider = repository.findById(providerId)
                        .orElseThrow(() -> new LLMProviderException(HttpStatus.NOT_FOUND, "Provider not found."));

            Map<String, Object> manifest = asMap(provider.getManifest());
            Map<String, Object> remote = asMap(asMap(manifest.get("model_discovery")).get("remote"));
            String path = remote.get("path") instanceof String value ? value : null;
            String baseUrl = baseUrl(asMap(manifest.get("configuration")));
            if (path == null || baseUrl == null) {
                  throw new LLMProviderException(HttpStatus.UNPROCESSABLE_ENTITY, "This provider does not support listing models.");
            }

            String secret;
            try {
                  secret = credentialService.getSecret(userId, credentialId);
            } catch (CredentialNotFoundException exception) {
                  throw new LLMProviderException(HttpStatus.NOT_FOUND, "Credential not found.");
            } catch (IllegalStateException exception) {
                  throw new LLMProviderException(HttpStatus.BAD_REQUEST, "This credential is not active, so it cannot be used.");
            }

            final String apiKey = secret.strip();
            String authentication = remote.get("authentication") instanceof String value ? value : "bearer";
            Map<String, Object> extraHeaders = asMap(remote.get("headers"));
            Map<String, Object> body;
            try {
                  body = client.get()
                        .uri(URI.create(join(baseUrl, path)))
                              .headers(headers -> {
                                    if ("bearer".equalsIgnoreCase(authentication)) {
                                          headers.setBearerAuth(apiKey);
                                    } else {
                                          headers.set(authentication, apiKey);
                                    }
                                    extraHeaders.forEach((name, value) -> {
                                          if (value instanceof String text) {
                                                headers.set(name, text);
                                          }
                                    });
                              })
                              .retrieve()
                              .body(JSON_OBJECT);
            } catch (RestClientResponseException exception) {
                  int status = exception.getStatusCode().value();
                  String reason = providerMessage(exception.getResponseBodyAsString());
                  String detail = reason == null ? "" : " (" + reason + ")";
                  if (status == 401 || status == 403 || (status == 400 && reason != null && reason.toLowerCase().contains("api key"))) {
                        throw new LLMProviderException(HttpStatus.BAD_GATEWAY, provider.getName() + " rejected this API key" + detail + ".");
                  }
                  throw new LLMProviderException(HttpStatus.BAD_GATEWAY, provider.getName() + " could not list models: HTTP " + status + detail + ".");
            } catch (RuntimeException exception) {
                  throw new LLMProviderException(HttpStatus.BAD_GATEWAY, "Unable to reach " + provider.getName() + ".");
            }

            Map<String, Object> response = asMap(remote.get("response"));
            String modelsPath = response.get("models_path") instanceof String value ? value : "data";
            String idField = response.get("id_field") instanceof String value ? value : "id";
            String nameField = response.get("name_field") instanceof String value ? value : idField;
            String stripPrefix = response.get("id_strip_prefix") instanceof String value ? value : "";

            List<ProviderModelResponse> models = new ArrayList<>();
            if (body != null && body.get(modelsPath) instanceof List<?> items) {
                  for (Object item : items) {
                        Map<String, Object> entry = asMap(item);
                        if (entry.get(idField) instanceof String rawId && !rawId.isBlank()) {
                              String id = !stripPrefix.isEmpty() && rawId.startsWith(stripPrefix) ? rawId.substring(stripPrefix.length()) : rawId;
                              models.add(new ProviderModelResponse(id, entry.get(nameField) instanceof String name && !name.isBlank() ? name : id));
                        }
                  }
            }
            models.sort((a, b) -> a.name().compareToIgnoreCase(b.name()));
            return models;
      }

      static String providerMessage(String body) {
            if (body == null) {
                  return null;
            }
            java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("\"message\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"").matcher(body);
            if (!matcher.find()) {
                  return null;
            }
            String message = matcher.group(1).replace("\\n", " ").replace("\\\"", "\"").strip();
            return message.length() > 160 ? message.substring(0, 160) + "…" : message;
      }

      private static String baseUrl(Map<String, Object> configuration) {
            if (configuration.get("fields") instanceof List<?> fields) {
                  for (Object field : fields) {
                        Map<String, Object> definition = asMap(field);
                        if ("base_url".equals(definition.get("key"))) {
                              Object value = definition.get("default") != null ? definition.get("default") : definition.get("placeholder");
                              if (value instanceof String url && url.startsWith("https://")) {
                                    return url;
                              }
                        }
                  }
            }
            return null;
      }

      static String join(String base, String path) {
            String trimmedBase = base.endsWith("/") ? base.substring(0, base.length() - 1) : base;
            String normalizedPath = path.startsWith("/") ? path : "/" + path;
            String basePath = URI.create(trimmedBase).getPath();
            if (basePath != null && !basePath.isEmpty() && normalizedPath.startsWith(basePath + "/")) {
                  return trimmedBase.substring(0, trimmedBase.length() - basePath.length()) + normalizedPath;
            }
            return trimmedBase + normalizedPath;
      }

      @SuppressWarnings("unchecked")
      private static Map<String, Object> asMap(Object value) {
            return value instanceof Map<?, ?> map ? (Map<String, Object>) map : Map.of();
      }
}
