package com.aiverse.gateway.authentication.services;

import java.io.IOException;
import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.MessageSource;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.authentication.AuthenticationFailureHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class OAuth2AuthenticationFailureHandler implements AuthenticationFailureHandler {

      public static final String ERROR_PARAM = "error";
      public static final String ERROR_CODE = "oauth_failed";
      private static final Logger log = LoggerFactory.getLogger(OAuth2AuthenticationFailureHandler.class)
      private final MessageSource messages;
      private final String frontendFailureUrl;
      public OAuth2AuthenticationFailureHandler(MessageSource messages,@Value("${aiverse.oauth.frontend-failure-url}") String frontendFailureUrl) {
            this.messages = messages;
            this.frontendFailureUrl = frontendFailureUrl;
      }

      @Override
      public void onAuthenticationFailure(HttpServletRequest request,HttpServletResponse response,AuthenticationException exception) throws IOException {
            log.warn(messages.getMessage("oauth.login.provider.error", new Object[] { exception.getMessage() },Locale.getDefault()));
            redirect(response);
      }

      public void redirect(HttpServletResponse response) throws IOException {
            response.sendRedirect(UriComponentsBuilder.fromUriString(frontendFailureUrl).queryParam(ERROR_PARAM, ERROR_CODE).build().encode().toUriString());
      }
}
