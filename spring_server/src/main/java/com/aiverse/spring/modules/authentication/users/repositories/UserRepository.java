package com.aiverse.spring.modules.authentication.users.repositories;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.aiverse.spring.modules.authentication.users.entities.User;
import com.aiverse.spring.modules.authentication.users.enums.Role;

public interface UserRepository extends JpaRepository<User, UUID> {

      boolean existsByEmailIgnoreCase(String email);

      boolean existsByUsernameIgnoreCase(String username);

      boolean existsByRole(Role role);
}
