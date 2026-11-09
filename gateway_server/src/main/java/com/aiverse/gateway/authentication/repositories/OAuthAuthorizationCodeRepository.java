
package com.aiverse.gateway.authentication.repositories;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.aiverse.gateway.authentication.entity.OAuthAuthorizationCode;

@Repository
public interface OAuthAuthorizationCodeRepository
            extends JpaRepository<OAuthAuthorizationCode, UUID> {

      Optional<OAuthAuthorizationCode> findByCode(String code);

      @Lock(LockModeType.PESSIMISTIC_WRITE)
      @Query("SELECT c FROM OAuthAuthorizationCode c JOIN FETCH c.user WHERE c.code = :code")
      Optional<OAuthAuthorizationCode> findByCodeForUpdate(@Param("code") String code);
}
