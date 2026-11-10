package com.aiverse.gateway.authentication.configurations;

import java.io.IOException;
import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;


public class UserIdentityHeaderFilter extends OncePerRequestFilter {

      private static final Logger log = LoggerFactory.getLogger(UserIdentityHeaderFilter.class);

      public static final String HEADER = "X-User-Id";

      private final MessageSource messages;

      public UserIdentityHeaderFilter(MessageSource messages) {
            this.messages = messages;
      }

      @Override
      protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
            if (request.getHeader(HEADER) != null) {
                  // a client has no business sending this: note the attempt (never the value) and drop it below
                  log.warn(messages.getMessage("auth.identity.header.discarded", new Object[] { request.getMethod(), request.getRequestURI() }, Locale.getDefault()));
            }
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            String userId = authentication != null && authentication.isAuthenticated() && !(authentication instanceof AnonymousAuthenticationToken) && authentication.getPrincipal() instanceof String subject ? subject : null;
            filterChain.doFilter(new IdentityRequest(request, userId), response);
      }


      private static final class IdentityRequest extends HttpServletRequestWrapper {

            private final String userId;

            private IdentityRequest(HttpServletRequest request, String userId) {
                  super(request);
                  this.userId = userId;
            }

            @Override
            public String getHeader(String name) {
                  return HEADER.equalsIgnoreCase(name) ? userId : super.getHeader(name);
            }

            @Override
            public Enumeration<String> getHeaders(String name) {
                  if (!HEADER.equalsIgnoreCase(name)) {
                        return super.getHeaders(name);
                  }
                  return userId == null ? Collections.emptyEnumeration() : Collections.enumeration(Set.of(userId));
            }

            @Override
            public Enumeration<String> getHeaderNames() {
                  Set<String> names = new LinkedHashSet<>();
                  Enumeration<String> original = super.getHeaderNames();
                  while (original != null && original.hasMoreElements()) {
                        String name = original.nextElement();
                        if (!HEADER.equalsIgnoreCase(name)) {
                              names.add(name);
                        }
                  }
                  if (userId != null) {
                        names.add(HEADER);
                  }
                  return Collections.enumeration(names);
            }
      }
}
