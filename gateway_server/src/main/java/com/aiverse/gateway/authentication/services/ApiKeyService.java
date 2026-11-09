
package com.aiverse.gateway.authentication.services;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.Locale;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Service;

@Service
public class ApiKeyService {
      private static final Logger log = LoggerFactory.getLogger(ApiKeyService.class);
      private static final int GCM_IV_BYTES = 12;
      private static final int GCM_TAG_BITS = 128;
      private final SecretKeySpec secretKey;
      private final MessageSource messages;

      public ApiKeyService(@Value("${aiverse.security.api-key-secret}") String base64Secret, MessageSource messages) {
            this.messages = messages;
            byte[] keyBytes;
            try {
                  keyBytes = Base64.getDecoder().decode(base64Secret);
            } catch (IllegalArgumentException exception) {
                  throw new IllegalStateException(message("apikey.secret.invalid"), exception);
            }
            if (keyBytes.length != 32) {
                  throw new IllegalStateException(message("apikey.secret.invalid"));
            }
            this.secretKey = new SecretKeySpec(keyBytes, "AES");
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      public boolean matches(String plainApiKey, String encryptedApiKey) {
            if (plainApiKey == null || encryptedApiKey == null || plainApiKey.isBlank()) {
                  return false;
            }
            try {
                  byte[] payload = Base64.getDecoder().decode(encryptedApiKey);
                  if (payload.length < GCM_IV_BYTES + 16) {
                        return false;
                  }
                  Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                  cipher.init(Cipher.DECRYPT_MODE,secretKey,new GCMParameterSpec(GCM_TAG_BITS, payload, 0, GCM_IV_BYTES));
                  byte[] decrypted = cipher.doFinal(payload,GCM_IV_BYTES,payload.length - GCM_IV_BYTES);
                  return MessageDigest.isEqual(plainApiKey.getBytes(StandardCharsets.UTF_8),decrypted);
            } catch (Exception exception) {
                  // Never log the key itself, only why verification failed.
                  log.warn(message("apikey.match.failed", exception.getClass().getSimpleName()));
                  return false;
            }
      }
}
