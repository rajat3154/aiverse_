package com.aiverse.spring.modules.users.controllers;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.aiverse.spring.modules.users.dtos.requests.CreateUserRequest;
import com.aiverse.spring.modules.users.dtos.requests.UpdateUserRequest;
import com.aiverse.spring.modules.users.dtos.responses.UserResponse;
import com.aiverse.spring.modules.users.services.UserService;

import jakarta.validation.Valid;


@RestController
@RequestMapping("/api/users")
public class UserController {

      private final UserService userService;

      public UserController(UserService userService) {
            this.userService = userService;
      }

      @GetMapping
      public ResponseEntity<List<UserResponse>> getAllUsers() {
            return ResponseEntity.ok(userService.getAllUsers());
      }

      @GetMapping("/{tenantId}")
      public ResponseEntity<UserResponse> getUser(@PathVariable UUID tenantId) {
            return ResponseEntity.ok(userService.getUser(tenantId));
      }

      @PostMapping
      public ResponseEntity<UserResponse> createUser(@Valid @RequestBody CreateUserRequest request) {
            return ResponseEntity.status(HttpStatus.CREATED).body(userService.createUser(request));
      }

      @PatchMapping("/{tenantId}")
      public ResponseEntity<UserResponse> updateUser(@PathVariable UUID tenantId,
                  @Valid @RequestBody UpdateUserRequest request) {
            return ResponseEntity.ok(userService.updateUser(tenantId, request));
      }

      @DeleteMapping("/{tenantId}")
      public ResponseEntity<Void> deleteUser(@PathVariable UUID tenantId) {
            userService.deleteUser(tenantId);
            return ResponseEntity.noContent().build();
      }
}
