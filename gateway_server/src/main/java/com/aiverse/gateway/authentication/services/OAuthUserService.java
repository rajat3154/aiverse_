package com.aiverse.gateway.authentication.services;

import java.text.Normalizer;
import java.util.Locale;
import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.aiverse.gateway.authentication.entity.User;
import com.aiverse.gateway.authentication.entity.UserAuthProvider;
import com.aiverse.gateway.authentication.enums.AuthProvider;
import com.aiverse.gateway.authentication.repositories.UserAuthProviderRepository;
import com.aiverse.gateway.authentication.repositories.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class OAuthUserService {
      private final UserRepository userRepository;
      private final UserAuthProviderRepository providerRepository;
      private final ApiKeyService apiKeyService;

      @Transactional
      public User resolveUser( AuthProvider provider, String providerUserId, String email, boolean emailVerified, String firstName, String lastName, String profilePhoto) {
            if (provider == null || provider == AuthProvider.LOCAL) {
                  throw new IllegalArgumentException("A valid OAuth provider is required.");
            }
            if (providerUserId == null || providerUserId.isBlank()) {
                  throw new IllegalArgumentException("Provider user ID is required.");
            }
            return providerRepository
                        .findByProviderAndProviderUserId(provider, providerUserId)
                        .map(UserAuthProvider::getUser)
                        .orElseGet(() -> createOrLinkUser(provider, providerUserId, email, emailVerified,firstName, lastName, profilePhoto));
      }

      private User createOrLinkUser( AuthProvider provider, String providerUserId, String email, boolean emailVerified, String firstName, String lastName, String profilePhoto) {
            String normalizedEmail = normalizeEmail(email);
            if (normalizedEmail == null || !emailVerified) {
                  throw new IllegalArgumentException("A verified email address is required to create or link an AIVERSE account.");
            }
            User user = userRepository.findByEmailIgnoreCase(normalizedEmail).orElseGet(() -> createUser(normalizedEmail, firstName, lastName, profilePhoto));
            if (providerRepository.findByUser_TenantIdAndProvider(user.getTenantId(), provider).isPresent()) {
                  throw new IllegalArgumentException("This account is already linked to a different identity from this provider.");
            }
            providerRepository.save(UserAuthProvider.create(user, provider, providerUserId, normalizedEmail));
            return user;
      }

      private User createUser(String email,String firstName,String lastName,String profilePhoto) {
            String safeFirstName = normalizeName(firstName, "User");
            String safeLastName = normalizeName(lastName, "");
            String username = generateUsername(email, safeFirstName);
            String plainApiKey = apiKeyService.generate();
            String encryptedApiKey = apiKeyService.encrypt(plainApiKey);
            User user = User.builder()
                        .apiKey(encryptedApiKey)
                        .firstName(safeFirstName)
                        .lastName(safeLastName)
                        .email(email)
                        .username(username)
                        .profilePhoto(profilePhoto)
                        .password(null)
                        .role("USER")
                        .accountType("GENERAL_USER")
                        .emailVerified(true)
                        .phoneVerified(false)
                        .enabled(true)
                        .build();
            return userRepository.save(user);
      }

      private String generateUsername(String email, String firstName) {
            String localPart = email.substring(0, email.indexOf('@'));
            String base = slug(localPart);
            if (base.isBlank()) {
                  base = slug(firstName);
            }
            if (base.isBlank()) {
                  base = "user";
            }
            String candidate = base;
            while (userRepository.existsByUsernameIgnoreCase(candidate)) {
                  candidate = base + UUID.randomUUID().toString().substring(0, 8);
            }
            return candidate;
      }

      private String normalizeEmail(String email) {
            if (email == null || email.isBlank()) {
                  return null;
            }
            return email.trim().toLowerCase(Locale.ROOT);
      }

      private String normalizeName(String value, String fallback) {
            if (value == null || value.isBlank()) {
                  return fallback;
            }
            return value.trim();
      }

      private String slug(String value) {
            String normalized = Normalizer.normalize(value, Normalizer.Form.NFD)
                        .replaceAll("\\p{M}", "")
                        .toLowerCase(Locale.ROOT)
                        .replaceAll("[^a-z0-9]+", "_")
                        .replaceAll("^_+|_+$", "");
            return normalized.length() > 40 ? normalized.substring(0, 40) : normalized;
      }
}