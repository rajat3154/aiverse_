package com.aiverse.gateway.authentication.services;

import java.io.IOException;
import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import com.aiverse.gateway.authentication.dtos.OAuthUserProfile;
import com.aiverse.gateway.authentication.entity.User;
import com.aiverse.gateway.authentication.enums.AuthProvider;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;


@Component
public class OAuth2AuthenticationSuccessHandler implements AuthenticationSuccessHandler {

      private static final Logger log = LoggerFactory.getLogger(OAuth2AuthenticationSuccessHandler.class);

      private final OAuth2AuthorizedClientService authorizedClientService;
      private final GitHubEmailService gitHubEmailService;
      private final OAuthProfileResolver profileResolver;
      private final OAuthUserService oauthUserService;
      private final OAuthAuthorizationCodeService authorizationCodeService;
      private final OAuth2AuthenticationFailureHandler failureHandler;
      private final MessageSource messages;

      private final String frontendSuccessUrl;

      public OAuth2AuthenticationSuccessHandler(
                  OAuth2AuthorizedClientService authorizedClientService,
                  GitHubEmailService gitHubEmailService,
                  OAuthProfileResolver profileResolver,
                  OAuthUserService oauthUserService,
                  OAuthAuthorizationCodeService authorizationCodeService,
                  OAuth2AuthenticationFailureHandler failureHandler,
                  MessageSource messages,
                  @Value("${aiverse.oauth.frontend-success-url}") String frontendSuccessUrl) {
            this.authorizedClientService = authorizedClientService;
            this.gitHubEmailService = gitHubEmailService;
            this.profileResolver = profileResolver;
            this.oauthUserService = oauthUserService;
            this.authorizationCodeService = authorizationCodeService;
            this.failureHandler = failureHandler;
            this.messages = messages;
            this.frontendSuccessUrl = frontendSuccessUrl;
      }

      private String message(String key, Object... args) {
            return messages.getMessage(key, args, Locale.getDefault());
      }

      @Override
      public void onAuthenticationSuccess(HttpServletRequest request,HttpServletResponse response,Authentication authentication) throws IOException, ServletException {
            long startedAt = System.currentTimeMillis();
            if (!(authentication instanceof OAuth2AuthenticationToken oauthToken)) {
                  log.warn(message("oauth.login.not.oauth"));
                  failureHandler.redirect(response);
                  return;
            }
            String registrationId = oauthToken.getAuthorizedClientRegistrationId();
            log.info(message("oauth.login.started", registrationId));
            try {
                  AuthProvider provider = resolveProvider(registrationId);
                  OAuth2User oauthUser = oauthToken.getPrincipal();
                  OAuth2AuthorizedClient client = authorizedClientService.loadAuthorizedClient(registrationId, oauthToken.getName());
                  if (client == null || client.getAccessToken() == null) {
                        log.warn(message("oauth.login.no.client", registrationId));
                        failureHandler.redirect(response);
                        return;
                  }
                  String verifiedGitHubEmail = null;
                  if (provider == AuthProvider.GITHUB) {
                        verifiedGitHubEmail = gitHubEmailService.getVerifiedPrimaryEmail(client.getAccessToken().getTokenValue());
                  }
                  OAuthUserProfile profile = profileResolver.resolve(provider, oauthUser, verifiedGitHubEmail);
                  User user = oauthUserService.resolveUser(provider,profile.providerUserId(),profile.email(),profile.emailVerified(),profile.firstName(),profile.lastName(),profile.profilePhoto());
                  String code = authorizationCodeService.createCode(user);
                  String redirectUrl = UriComponentsBuilder
                              .fromUriString(frontendSuccessUrl)
                              .queryParam("code", code)
                              .build()
                              .encode()
                              .toUriString();
                  log.info(message("oauth.login.completed", registrationId, user.getTenantId(),
                              System.currentTimeMillis() - startedAt));
                  response.sendRedirect(redirectUrl);
            } catch (RuntimeException exception) {
                  log.warn(message("oauth.login.rejected", registrationId, exception.getMessage(),System.currentTimeMillis() - startedAt), exception);
                  failureHandler.redirect(response);
            } finally {
                  authorizedClientService.removeAuthorizedClient(registrationId, oauthToken.getName());
                  var session = request.getSession(false);
                  if (session != null) {
                        session.invalidate();
                  }
            }
      }

      private AuthProvider resolveProvider(String registrationId) {
            return switch (registrationId.toLowerCase(Locale.ROOT)) {
                  case "google" -> AuthProvider.GOOGLE;
                  case "github" -> AuthProvider.GITHUB;
                  default -> throw new IllegalArgumentException(message("oauth.provider.unsupported", registrationId));
            };
      }
}
