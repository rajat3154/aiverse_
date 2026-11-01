package com.aiverse.logging.otel;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.ThrowableProxyUtil;
import ch.qos.logback.core.AppenderBase;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.api.logs.LogRecordBuilder;
import io.opentelemetry.api.logs.Logger;
import io.opentelemetry.api.logs.Severity;
import io.opentelemetry.sdk.logs.SdkLoggerProvider;

import java.time.Instant;
import java.util.Map;

public class AiverseOtelAppender extends AppenderBase<ILoggingEvent> {
    private SdkLoggerProvider loggerProvider;
    private Logger otelLogger;

    @Override
    public void start() {
        try {
            loggerProvider = AiverseOtelLogging.createLoggerProvider(getContext());
            otelLogger = loggerProvider.get("aiverse.logging");
            super.start();
        } catch (Exception exception) {
            addWarn("AIVERSE OTLP logging disabled: " + exception.getMessage(), exception);
            super.start();
        }
    }

    @Override
    protected void append(ILoggingEvent event) {
        if (otelLogger == null) return;
        LogRecordBuilder record = otelLogger.logRecordBuilder()
                .setTimestamp(Instant.ofEpochMilli(event.getTimeStamp()))
                .setSeverity(toSeverity(event.getLevel()))
                .setSeverityText(event.getLevel().toString())
                .setBody(event.getFormattedMessage())
                .setAttribute(AttributeKey.stringKey("logger.name"), event.getLoggerName())
                .setAttribute(AttributeKey.stringKey("thread.name"), event.getThreadName());
        Map<String, String> mdc = event.getMDCPropertyMap();
        if (mdc != null) {
            mdc.forEach((key, value) -> {
                if (value != null) {
                    record.setAttribute(AttributeKey.stringKey(key), value);
                }
            });
        }
        if (event.getThrowableProxy() != null) {
            record.setAttribute(AttributeKey.stringKey("error.type"),event.getThrowableProxy().getClassName());
            record.setAttribute(AttributeKey.stringKey("error.message"),String.valueOf(event.getThrowableProxy().getMessage()));
            record.setAttribute(AttributeKey.stringKey("error.stack_trace"),ThrowableProxyUtil.asString(event.getThrowableProxy()));
        }
        record.emit();
    }

    private Severity toSeverity(Level level) {
        if (level.isGreaterOrEqual(Level.ERROR)) return Severity.ERROR;
        if (level.isGreaterOrEqual(Level.WARN)) return Severity.WARN;
        if (level.isGreaterOrEqual(Level.INFO)) return Severity.INFO;
        if (level.isGreaterOrEqual(Level.DEBUG)) return Severity.DEBUG;
        return Severity.TRACE;
    }

    @Override
    public void stop() {
        super.stop();
        if (loggerProvider != null) {
            loggerProvider.close();
        }
    }
}
