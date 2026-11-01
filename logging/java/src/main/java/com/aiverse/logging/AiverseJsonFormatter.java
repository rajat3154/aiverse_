package com.aiverse.logging;

import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.IThrowableProxy;
import ch.qos.logback.classic.spi.StackTraceElementProxy;
import ch.qos.logback.core.LayoutBase;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanContext;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

public class AiverseJsonFormatter extends LayoutBase<ILoggingEvent> {
    private static final ObjectMapper MAPPER = new ObjectMapper();

    @Override
    public String doLayout(ILoggingEvent event) {
        Map<String, Object> result = new LinkedHashMap<>();
        Map<String, Object> service = new LinkedHashMap<>();
        Map<String, Object> deployment = new LinkedHashMap<>();
        Map<String, Object> eventData = new LinkedHashMap<>();
        Map<String, Object> context = new LinkedHashMap<>();

        service.put("name", env(getContext(), "OTEL_SERVICE_NAME", "unknown_service"));
        service.put("namespace", env(getContext(), "OTEL_SERVICE_NAMESPACE", "aiverse"));
        service.put("version", env(getContext(), "AIVERSE_SERVICE_VERSION", "0.1.0"));

        deployment.put("environment", env(getContext(), "OTEL_DEPLOYMENT_ENVIRONMENT", env(getContext(), "AIVERSE_ENVIRONMENT", "development")));

        eventData.put("domain", "SYSTEM");
        eventData.put("action", event.getLoggerName());
        eventData.put("outcome", event.getLevel().isGreaterOrEqual(ch.qos.logback.classic.Level.ERROR) ? "FAILURE" : "SUCCESS");

        Map<String, String> mdc = event.getMDCPropertyMap();
        if (mdc != null) context.putAll(mdc);

        SpanContext spanContext = Span.current().getSpanContext();
        if (spanContext.isValid()) {
            context.put("trace_id", spanContext.getTraceId());
            context.put("span_id", spanContext.getSpanId());
        }

        result.put("timestamp", Instant.ofEpochMilli(event.getTimeStamp()).toString());
        result.put("severity", event.getLevel().toString());
        result.put("message", event.getFormattedMessage());
        result.put("service", service);
        result.put("deployment", deployment);
        result.put("event", eventData);
        result.put("context", context);
        result.put("error", buildError(event.getThrowableProxy()));

        try {
            return MAPPER.writeValueAsString(result) + System.lineSeparator();
        } catch (Exception exception) {
            addError("Unable to serialize AIVERSE log event", exception);
            return "{\"severity\":\"ERROR\",\"message\":\"Log serialization failed\"}" + System.lineSeparator();
        }
    }

    private static Map<String, Object> buildError(IThrowableProxy throwable) {
        if (throwable == null) return null;

        Map<String, Object> error = new LinkedHashMap<>();
        error.put("type", throwable.getClassName());
        error.put("message", throwable.getMessage());

        StringBuilder stackTrace = new StringBuilder();
        for (StackTraceElementProxy element : throwable.getStackTraceElementProxyArray()) {
            stackTrace.append("\tat ").append(element.getSTEAsString()).append('\n');
        }
        error.put("stack_trace", stackTrace.toString());
        return error;
    }

    private static String env(ch.qos.logback.core.Context context, String key, String fallback) {
        return AiverseEnv.get(context, key, fallback);
    }
}
