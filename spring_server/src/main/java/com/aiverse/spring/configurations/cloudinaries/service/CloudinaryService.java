package com.aiverse.spring.configurations.cloudinaries.service;

import java.util.Locale;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.aiverse.spring.configurations.rabbitmqs.RabbitMQService;
import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;

@Service
public class CloudinaryService {

      private static final Logger log = LoggerFactory.getLogger(CloudinaryService.class);

      private final Cloudinary cloudinary;
      private final RabbitMQService rabbitMQService;
      private final MessageSource messages;

      public CloudinaryService(Cloudinary cloudinary, RabbitMQService rabbitMQService, MessageSource messages) {
            this.cloudinary = cloudinary;
            this.rabbitMQService = rabbitMQService;
            this.messages = messages;
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      @SuppressWarnings("unchecked")
      public Map<String, Object> uploadFile(MultipartFile file, String folder) {
            if (file == null || file.isEmpty()) {
                  log.warn(message("cloudinary.upload.rejected"));
                  throw new IllegalArgumentException("File cannot be empty");
            }
            String filename = file.getOriginalFilename();
            long startedAt = System.currentTimeMillis();
            try {
                  log.info(message("cloudinary.upload.started", filename, folder));
                  Map<String, Object> options = ObjectUtils.asMap(
                              "resource_type", "image",
                              "folder", folder,
                              "use_filename", true,
                              "unique_filename", true,
                              "overwrite", false);
                  Map<String, Object> result = cloudinary.uploader().upload(file.getBytes(), options);
                  log.info(message("cloudinary.upload.completed", filename, result.get("public_id"),
                              result.get("resource_type"), System.currentTimeMillis() - startedAt));
                  rabbitMQService.raiseEventSafely("CLOUDINARY_UPLOAD", Map.of(
                              "filename", filename == null ? "" : filename,
                              "public_id", String.valueOf(result.get("public_id")),
                              "resource_type", String.valueOf(result.get("resource_type")),
                              "format", String.valueOf(result.get("format")),
                              "url", String.valueOf(result.get("secure_url"))));
                  return result;
            } catch (Exception error) {
                  log.error(message("cloudinary.upload.failed", filename, error.getMessage()), error);
                  throw new RuntimeException("Cloudinary upload failed", error);
            }
      }

      @SuppressWarnings("unchecked")
      public Map<String, Object> deleteFile(String publicId, String resourceType) {
            try {
                  Map<String, Object> result = cloudinary.uploader().destroy(publicId,
                              ObjectUtils.asMap("resource_type", resourceType));
                  log.info(message("cloudinary.delete.completed", publicId, result.get("result")));
                  rabbitMQService.raiseEventSafely("CLOUDINARY_DELETE", Map.of(
                              "public_id", publicId,
                              "resource_type", resourceType,
                              "result", String.valueOf(result.get("result"))));
                  return result;
            } catch (Exception error) {
                  log.error(message("cloudinary.delete.failed", publicId, error.getMessage()), error);
                  throw new RuntimeException("Cloudinary delete failed", error);
            }
      }
}
