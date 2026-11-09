package com.aiverse.gateway.authentication.services;

import java.util.Map;
import java.util.Objects;

import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Component;

import com.aiverse.gateway.authentication.dtos.OAuthUserProfile;
import com.aiverse.gateway.authentication.enums.AuthProvider;

@Component
public class OAuthProfileResolver {

      public OAuthUserProfile resolve(AuthProvider provider, OAuth2User oauthUser, String verifiedEmail) {
            Map<String, Object> attributes = oauthUser.getAttributes();
            return switch (provider) {
                  case GOOGLE -> resolveGoogle(attributes);
                  case GITHUB -> resolveGitHub(attributes, verifiedEmail);
                  default -> throw new IllegalArgumentException("Unsupported OAuth provider.");
            };
      }

      private OAuthUserProfile resolveGoogle(Map<String, Object> attributes) {
            String email = string(attributes.get("email"));
            boolean verified = Boolean.TRUE.equals(attributes.get("email_verified"));
            return new OAuthUserProfile(
                        string(attributes.get("sub")),
                        email,
                        verified,
                        string(attributes.get("given_name")),
                        string(attributes.get("family_name")),
                        string(attributes.get("picture")));
      }

      private OAuthUserProfile resolveGitHub(Map<String, Object> attributes, String verifiedEmail) {
            String name = string(attributes.get("name"));
            String login = string(attributes.get("login"));
            String[] names = splitName(name, login);
            return new OAuthUserProfile(
                        Objects.toString(attributes.get("id"), null),
                        verifiedEmail,
                        verifiedEmail != null && !verifiedEmail.isBlank(),
                        names[0],
                        names[1],
                        string(attributes.get("avatar_url")));
      }

      private String[] splitName(String name, String fallback) {
            String value = name == null || name.isBlank() ? fallback : name.trim();
            if (value == null || value.isBlank()) {
                  return new String[] { "GitHub", "User" };
            }
            int separator = value.indexOf(' ');
            if (separator < 0) {
                  return new String[] { value, "" };
            }
            return new String[] {
                        value.substring(0, separator).trim(),
                        value.substring(separator + 1).trim()
            };
      }

      private String string(Object value) {
            return value == null ? null : value.toString();
      }
}