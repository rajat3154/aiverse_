package com.aiverse.spring.configurations.websockets.configuration;

import java.util.Map;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.servlet.HandlerMapping;

public class UserHandshakeInterceptor implements HandshakeInterceptor {

      @Override
      @SuppressWarnings("unchecked")
      public boolean beforeHandshake(ServerHttpRequest request,ServerHttpResponse response,WebSocketHandler wsHandler,Map<String, Object> attributes) {
            if (!(request instanceof ServletServerHttpRequest)) {
                  return true;
            }
            Object pathVariables = ((ServletServerHttpRequest) request).getServletRequest().getAttribute(HandlerMapping.URI_TEMPLATE_VARIABLES_ATTRIBUTE);
            if (pathVariables instanceof Map) {
                  Object userId = ((Map<String, Object>) pathVariables).get("userId");
                  if (userId != null) {
                        attributes.put("userId", userId.toString());
                  }
            }
            if (!attributes.containsKey("userId")) {
                  String path = request.getURI().getPath();
                  String userId = path.substring(path.lastIndexOf('/') + 1);
                  if (!userId.isBlank()) {
                        attributes.put("userId", userId);
                  }
            }
            return true;
      }

      @Override
      public void afterHandshake(ServerHttpRequest request,ServerHttpResponse response,WebSocketHandler wsHandler,Exception exception) {
            
      }
}
