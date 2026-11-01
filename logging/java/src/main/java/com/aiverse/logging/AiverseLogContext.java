package com.aiverse.logging;

import org.slf4j.MDC;
import java.util.Map;
import java.util.UUID;

public final class AiverseLogContext {
    private static final String REQUEST_ID = "request_id";
    private AiverseLogContext() {}

    public static String generateRequestId() {
        return UUID.randomUUID().toString();
    }

    public static String getRequestId() {
        return MDC.get(REQUEST_ID);
    }

    public static void setRequestId(String requestId) {
        MDC.put(REQUEST_ID, requestId);
    }

    public static String initializeRequestId(String requestId) {
        String resolved = requestId == null || requestId.isBlank() ? generateRequestId() : requestId;
        setRequestId(resolved);
        return resolved;
    }

    public static void set(String key, String value) {
        if (key == null || key.isBlank()) {
            throw new IllegalArgumentException("Context key cannot be blank");
        }
        if (value == null) {
            MDC.remove(key);
        } else {
            MDC.put(key, value);
        }
    }

    public static String get(String key) {
        return MDC.get(key);
    }

    public static void setAll(Map<String, String> values) {
        if (values == null) return;
        values.forEach(AiverseLogContext::set);
    }

    public static Map<String, String> getAll() {
        Map<String, String> context = MDC.getCopyOfContextMap();
        return context == null ? Map.of() : Map.copyOf(context);
    }

    public static void clear() {
        MDC.clear();
    }
}
