package com.aiverse.spring.modules.credentials.repositories;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.aiverse.spring.modules.credentials.entities.Credential;

public interface CredentialRepository extends JpaRepository<Credential, UUID> {

      List<Credential> findAllByUserIdOrderByCreatedAtDesc(UUID userId);

      Optional<Credential> findByIdAndUserId(UUID id, UUID userId);

      boolean existsByUserIdAndNameIgnoreCase(UUID userId, String name);
}
