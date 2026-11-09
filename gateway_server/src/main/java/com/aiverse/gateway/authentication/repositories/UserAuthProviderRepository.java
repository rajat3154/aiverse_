package com.aiverse.gateway.authentication.repositories;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import com.aiverse.gateway.authentication.entity.UserAuthProvider;
import com.aiverse.gateway.authentication.enums.AuthProvider;

@Repository
public interface UserAuthProviderRepository extends JpaRepository<UserAuthProvider, UUID> {
      Optional<UserAuthProvider> findByProviderAndProviderUserId(AuthProvider provider, String providerUserId);

      Optional<UserAuthProvider> findByUser_TenantIdAndProvider(UUID tenantId, AuthProvider provider);

      boolean existsByProviderAndProviderUserId(AuthProvider provider, String providerUserId);
}