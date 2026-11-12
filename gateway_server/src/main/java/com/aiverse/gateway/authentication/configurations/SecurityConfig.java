package com.aiverse.gateway.authentication.configurations;

import java.util.Locale;

import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.aiverse.gateway.authentication.services.OAuth2AuthenticationFailureHandler;
import com.aiverse.gateway.authentication.services.OAuth2AuthenticationSuccessHandler;

import lombok.RequiredArgsConstructor;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {
      private static final Logger log = LoggerFactory.getLogger(SecurityConfig.class);
      private static final String[] PUBLIC_ENDPOINTS = {
                  "/api/v1/auth/login",
                  "/api/v1/auth/refresh",
                  "/api/v1/auth/logout",
                  "/api/v1/auth/oauth/exchange",
                  "/oauth2/authorization/**",
                  "/login/oauth2/code/**",
                  "/api/v1/identity/auth/signup",
                  "/api/v1/identity/cloudinary/upload",
                  "/actuator/health",
                  "/actuator/info"
      };

      private final JwtAuthenticationFilter jwtAuthenticationFilter;
      private final OAuth2AuthenticationSuccessHandler oauthSuccessHandler;
      private final OAuth2AuthenticationFailureHandler oauthFailureHandler;
      private final JsonErrorWriter errorWriter;
      private final MessageSource messages;

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      @Bean
      public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
            return http.csrf(AbstractHttpConfigurer::disable)
                        .cors(Customizer.withDefaults())
                        .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                        .authorizeHttpRequests(auth -> auth
                                    .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                                    .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                                    .requestMatchers("/api/v1/identity/users", "/api/v1/identity/users/**").hasRole("MASTER")
                                    .requestMatchers("/api/v1/identity/llm-providers/*/logo").hasRole("MASTER")
                                    .anyRequest().authenticated())
                        .exceptionHandling(handling -> handling
                                    .authenticationEntryPoint((request, response, exception) -> {
                                          log.warn(message("auth.request.unauthenticated", request.getMethod(),
                                                      request.getRequestURI()));
                                          errorWriter.write(response, HttpStatus.UNAUTHORIZED, message("auth.unauthorized"));
                                    })
                                    .accessDeniedHandler((request, response, exception) -> {
                                          log.warn(message("auth.request.forbidden", request.getMethod(),
                                                      request.getRequestURI()));
                                          errorWriter.write(response, HttpStatus.FORBIDDEN, message("auth.forbidden"));
                                    }))

                        .oauth2Login(oauth -> oauth
                                    .successHandler(oauthSuccessHandler)
                                    .failureHandler(oauthFailureHandler))
                        .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                        .addFilterAfter(new UserIdentityHeaderFilter(messages), JwtAuthenticationFilter.class)
                        .build();
      }

      @Bean
      public PasswordEncoder passwordEncoder() {
            return new BCryptPasswordEncoder();
      }
}
