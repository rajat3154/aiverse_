package com.aiverse.spring.modules.authentication.users.services;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Locale;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Service;

@Service
public class ApiKeyService {

      private static final String API_KEY_PREFIX = "aiv_";
      private static final int API_KEY_BYTES = 32;
      private static final int GCM_IV_BYTES = 12;
      private static final int GCM_TAG_BITS = 128;

      private final SecureRandom secureRandom = new SecureRandom();
      private final SecretKey secretKey;
      private final MessageSource messages;

      public ApiKeyService(@Value("${aiverse.security.api-key-secret}") String base64Secret, MessageSource messages) {
            this.messages = messages;
            byte[] keyBytes = Base64.getDecoder().decode(base64Secret);
            if (keyBytes.length != 32) {
                  throw new IllegalStateException(messages.getMessage("apikey.secret.invalid", null, Locale.getDefault()));
            }
            this.secretKey = new SecretKeySpec(keyBytes, "AES");
      }

      public String generate() {
            byte[] bytes = new byte[API_KEY_BYTES];
            secureRandom.nextBytes(bytes);
            return API_KEY_PREFIX + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
      }

      public String encrypt(String plainApiKey) {
            try {
                  byte[] iv = new byte[GCM_IV_BYTES];
                  secureRandom.nextBytes(iv);
                  Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                  cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_BITS, iv));
                  byte[] encrypted = cipher.doFinal(plainApiKey.getBytes(StandardCharsets.UTF_8));
                  byte[] payload = new byte[iv.length + encrypted.length];
                  System.arraycopy(iv, 0, payload, 0, iv.length);
                  System.arraycopy(encrypted, 0, payload, iv.length, encrypted.length);
                  return Base64.getEncoder().encodeToString(payload);
            } catch (GeneralSecurityException exception) {
                  throw new IllegalStateException(messages.getMessage("apikey.encrypt.failed", null, Locale.getDefault()), exception);
            }
      }

      public String decrypt(String encryptedApiKey) {
            try {
                  byte[] payload = Base64.getDecoder().decode(encryptedApiKey);
                  Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                  cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(GCM_TAG_BITS, payload, 0, GCM_IV_BYTES));
                  return new String(cipher.doFinal(payload, GCM_IV_BYTES, payload.length - GCM_IV_BYTES), StandardCharsets.UTF_8);
            } catch (GeneralSecurityException exception) {
                  throw new IllegalStateException(messages.getMessage("apikey.decrypt.failed", null, Locale.getDefault()), exception);
            }
      }
}
