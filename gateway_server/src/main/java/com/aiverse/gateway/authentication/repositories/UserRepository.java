
package com.aiverse.gateway.authentication.repositories;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.aiverse.gateway.authentication.entity.User;

@Repository
public interface UserRepository extends JpaRepository<User, UUID> {
      Optional<User> findByEmailIgnoreCase(String email);
      Optional<User> findByUsernameIgnoreCase(String username);
}
