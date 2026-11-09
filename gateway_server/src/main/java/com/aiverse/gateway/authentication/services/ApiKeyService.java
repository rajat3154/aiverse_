
package com.aiverse.gateway.authentication.services;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
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
    private static final String API_KEY_PREFIX = "aiv_";
    private static final int API_KEY_BYTES = 32;
    private static final int GCM_IV_BYTES = 12;
    private static final int GCM_TAG_BITS = 128;

    private final SecretKeySpec secretKey;
    private final MessageSource messages;
    private final SecureRandom secureRandom = new SecureRandom();

    public ApiKeyService(
        @Value("${aiverse.security.api-key-secret}") String base64Secret,
        MessageSource messages
    ) {
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

    public String generate() {
        byte[] randomBytes = new byte[API_KEY_BYTES];
        secureRandom.nextBytes(randomBytes);
        return API_KEY_PREFIX + Base64.getUrlEncoder()
            .withoutPadding()
            .encodeToString(randomBytes);
    }

    public String encrypt(String plainApiKey) {
        if (plainApiKey == null || plainApiKey.isBlank()) {
            throw new IllegalArgumentException("API key cannot be blank.");
        }

        try {
            byte[] iv = new byte[GCM_IV_BYTES];
            secureRandom.nextBytes(iv);

            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                Cipher.ENCRYPT_MODE,
                secretKey,
                new GCMParameterSpec(GCM_TAG_BITS, iv)
            );

            byte[] encrypted = cipher.doFinal(
                plainApiKey.getBytes(StandardCharsets.UTF_8)
            );

            byte[] payload = new byte[iv.length + encrypted.length];
            System.arraycopy(iv, 0, payload, 0, iv.length);
            System.arraycopy(encrypted, 0, payload, iv.length, encrypted.length);

            return Base64.getEncoder().encodeToString(payload);
        } catch (Exception exception) {
            throw new IllegalStateException(message("apikey.encrypt.failed"), exception);
        }
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
            cipher.init(
                Cipher.DECRYPT_MODE,
                secretKey,
                new GCMParameterSpec(GCM_TAG_BITS, payload, 0, GCM_IV_BYTES)
            );

            byte[] decrypted = cipher.doFinal(
                payload,
                GCM_IV_BYTES,
                payload.length - GCM_IV_BYTES
            );

            return MessageDigest.isEqual(
                plainApiKey.getBytes(StandardCharsets.UTF_8),
                decrypted
            );
        } catch (Exception exception) {
            // Never log the key itself, only why verification failed.
            log.warn(message("apikey.match.failed", exception.getClass().getSimpleName()));
            return false;
        }
    }
}
