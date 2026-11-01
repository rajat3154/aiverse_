package com.aiverse.logging;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;

public class AiverseRequestContextFilter implements Filter {
    private static final Logger log = LoggerFactory.getLogger(AiverseRequestContextFilter.class);
    public static final String REQUEST_ID_HEADER = "X-Request-ID";
    public static final String USER_ID_ATTRIBUTE = "user_id";
    public static final String ORG_ID_ATTRIBUTE = "org_id";

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {
        if (!(request instanceof HttpServletRequest httpRequest)) {
            chain.doFilter(request, response);
            return;
        }
        Map<String, String> previousContext = MDC.getCopyOfContextMap();
        long startTime = System.nanoTime();
        try {
            String requestId = AiverseLogContext.initializeRequestId(httpRequest.getHeader(REQUEST_ID_HEADER));
            AiverseLogContext.set("http_method", httpRequest.getMethod());
            AiverseLogContext.set("http_path", httpRequest.getRequestURI());
            setAttributeContext(httpRequest, USER_ID_ATTRIBUTE);
            setAttributeContext(httpRequest, ORG_ID_ATTRIBUTE);
            if (response instanceof HttpServletResponse httpResponse) {
                httpResponse.setHeader(REQUEST_ID_HEADER, requestId);
            }
            try {
                chain.doFilter(request, response);
            } finally {
                long durationMs = (System.nanoTime() - startTime) / 1_000_000;
                AiverseLogContext.set("duration_ms", String.valueOf(durationMs));
                if (response instanceof HttpServletResponse httpResponse) {
                    AiverseLogContext.set("http_status_code",String.valueOf(httpResponse.getStatus()));
                }
                log.info("HTTP request completed");
            }
        } finally {
            MDC.clear();
            if (previousContext != null) {
                MDC.setContextMap(previousContext);
            }
        }
    }

    private void setAttributeContext(HttpServletRequest request, String attributeName) {
        Object value = request.getAttribute(attributeName);
        if (value != null) {
            AiverseLogContext.set(attributeName, value.toString());
        }
    }
}
