package com.aiverse.logging;

import ch.qos.logback.core.Context;

public final class AiverseEnv {
    private AiverseEnv() {}

    public static String get(Context context, String key) {
        String value = context == null ? null : context.getProperty(key);
        if (value == null || value.isBlank()) {
            value = System.getenv(key);
        }
        return value == null || value.isBlank() ? null : value;
    }

    public static String get(Context context, String key, String fallback) {
        String value = get(context, key);
        return value == null ? fallback : value;
    }
}
