package com.aiverse.gateway.authentication.configurations;

import java.io.IOException;
import java.util.List;
import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.aiverse.gateway.authentication.services.JwtService;
import com.aiverse.logging.AiverseLogContext;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

      private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);
      private static final String BEARER_PREFIX = "Bearer ";

      private final JwtService jwtService;
      private final JsonErrorWriter errorWriter;
      private final MessageSource messages;

      public JwtAuthenticationFilter(JwtService jwtService, JsonErrorWriter errorWriter, MessageSource messages) {
            this.jwtService = jwtService;
            this.errorWriter = errorWriter;
            this.messages = messages;
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      @Override
      protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain filterChain) throws ServletException, IOException {
            String authorization = request.getHeader("Authorization");
            if (authorization == null || !authorization.startsWith(BEARER_PREFIX)) {
                  filterChain.doFilter(request, response);
                  return;
            }

            try {
                  Claims claims = jwtService.validateAccessToken(authorization.substring(BEARER_PREFIX.length()));
                  String role = claims.get("role", String.class);
                  List<GrantedAuthority> authorities = role == null ? List.of() : List.of(new SimpleGrantedAuthority("ROLE_" + role));
                  SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(claims.getSubject(), null, authorities));
                  // Every log line for the rest of this request now carries the caller.
                  AiverseLogContext.set("user_id", claims.getSubject());
                  log.debug(message("auth.token.accepted", claims.getSubject(), role));
            } catch (JwtException | IllegalArgumentException exception) {
                  SecurityContextHolder.clearContext();
                  log.warn(message("auth.token.rejected", request.getRequestURI(), exception.getMessage()));
                  errorWriter.write(response, HttpStatus.UNAUTHORIZED, message("auth.token.access.invalid"));
                  return;
            }
            try {
                  filterChain.doFilter(request, response);
            } finally {
                  // Tomcat reuses threads: do not let this caller's id leak into the next request's logs.
                  AiverseLogContext.set("user_id", null);
            }
      }
}
