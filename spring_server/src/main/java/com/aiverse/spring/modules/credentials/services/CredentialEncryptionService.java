package com.aiverse.spring.modules.credentials.services;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Locale;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Service;

import com.aiverse.spring.modules.credentials.exceptions.CredentialException;

@Service
public class CredentialEncryptionService {

      private static final String ALGORITHM = "AES/GCM/NoPadding";
      private static final int IV_LENGTH = 12;
      private static final int TAG_LENGTH = 128;
      private static final int MIN_SECRET_LENGTH = 16;

      private final SecretKeySpec secretKey;
      private final SecureRandom secureRandom = new SecureRandom();
      private final MessageSource messages;

      public CredentialEncryptionService(@Value("${aiverse.security.credentials-encryption-secret}") String encryptionSecret, MessageSource messages) {
            this.messages = messages;
            if (encryptionSecret == null || encryptionSecret.trim().length() < MIN_SECRET_LENGTH) {
                  throw new IllegalStateException(message("credentials.encryption.secret.invalid", MIN_SECRET_LENGTH));
            }
            try {
                  byte[] key = MessageDigest.getInstance("SHA-256").digest(encryptionSecret.trim().getBytes(StandardCharsets.UTF_8));
                  this.secretKey = new SecretKeySpec(key, "AES");
            } catch (Exception exception) {
                  throw new CredentialException(message("credentials.encryption.init.failed"), exception);
            }
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      public String encrypt(String plainText) {
            try {
                  byte[] iv = new byte[IV_LENGTH];
                  secureRandom.nextBytes(iv);
                  Cipher cipher = Cipher.getInstance(ALGORITHM);
                  cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(TAG_LENGTH, iv));
                  byte[] encrypted = cipher.doFinal(plainText.getBytes(StandardCharsets.UTF_8));
                  byte[] result = new byte[iv.length + encrypted.length];
                  System.arraycopy(iv, 0, result, 0, iv.length);
                  System.arraycopy(encrypted, 0, result, iv.length, encrypted.length);
                  return Base64.getEncoder().encodeToString(result);
            } catch (Exception exception) {
                  throw new CredentialException(message("credentials.encrypt.failed"), exception);
            }
      }

      public String decrypt(String encryptedText) {
            try {
                  byte[] decoded = Base64.getDecoder().decode(encryptedText);
                  byte[] iv = new byte[IV_LENGTH];
                  byte[] encrypted = new byte[decoded.length - IV_LENGTH];
                  System.arraycopy(decoded, 0, iv, 0, IV_LENGTH);
                  System.arraycopy(decoded, IV_LENGTH, encrypted, 0, encrypted.length);
                  Cipher cipher = Cipher.getInstance(ALGORITHM);
                  cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(TAG_LENGTH, iv));
                  return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
            } catch (Exception exception) {
                  throw new CredentialException(message("credentials.decrypt.failed"), exception);
            }
      }
}
