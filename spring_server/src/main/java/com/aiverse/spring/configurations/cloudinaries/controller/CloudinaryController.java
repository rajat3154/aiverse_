package com.aiverse.spring.configurations.cloudinaries.controller;

import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.aiverse.spring.configurations.cloudinaries.service.CloudinaryService;

@RestController
@RequestMapping("/api/cloudinary")
public class CloudinaryController {

      private final CloudinaryService cloudinaryService;

      public CloudinaryController(CloudinaryService cloudinaryService) {
            this.cloudinaryService = cloudinaryService;
      }

      @PostMapping("/upload")
      public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file) {
            try {
                  Map<String, Object> result = cloudinaryService.uploadFile(file, "aiverse/uploads");
                  return ResponseEntity.ok(Map.of("status", "success", "file", result));
            } catch (IllegalArgumentException error) {
                  return ResponseEntity.badRequest().body(Map.of("status", "error", "message", error.getMessage()));
            } catch (Exception error) {
                  return ResponseEntity.internalServerError().body(Map.of("status", "error", "message", "File upload failed"));
            }
      }
}
