package com.aiverse.gateway.authentication.services;

import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import com.aiverse.gateway.authentication.exceptions.InvalidTokenException;

@Service
public class GitHubEmailService {

      private static final Logger log = LoggerFactory.getLogger(GitHubEmailService.class);
      private final RestClient restClient;
      private final MessageSource messages;

      public GitHubEmailService(MessageSource messages) {
            this.messages = messages;
            this.restClient = RestClient.builder()
                        .baseUrl("https://api.github.com")
                        .defaultHeader(HttpHeaders.ACCEPT, "application/vnd.github+json")
                        .defaultHeader("X-GitHub-Api-Version", "2022-11-28")
                        .build();
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      public String getVerifiedPrimaryEmail(String accessToken) {
            if (accessToken == null || accessToken.isBlank()) {
                  throw new InvalidTokenException(message("oauth.github.token.required"));
            }
            List<Map<String, Object>> emails;
            try {
                  emails = restClient.get()
                              .uri("/user/emails")
                              .headers(headers -> headers.setBearerAuth(accessToken))
                              .retrieve()
                              .body(new ParameterizedTypeReference<>() {
                              });
            } catch (RestClientException exception) {
                  log.warn(message("oauth.github.email.failed", exception.getMessage()));
                  return null;
            }
            if (emails == null) {
                  log.warn(message("oauth.github.email.none"));
                  return null;
            }
            String email = emails.stream()
                        .filter(entry -> Boolean.TRUE.equals(entry.get("primary")))
                        .filter(entry -> Boolean.TRUE.equals(entry.get("verified")))
                        .map(entry -> entry.get("email"))
                        .filter(String.class::isInstance)
                        .map(String.class::cast)
                        .findFirst()
                        .orElse(null);
            if (email == null) {
                  log.warn(message("oauth.github.email.none"));
            } else {
                  log.debug(message("oauth.github.email.found"));
            }
            return email;
      }
}
