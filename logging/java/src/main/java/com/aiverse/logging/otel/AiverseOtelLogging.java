package com.aiverse.logging.otel;

import ch.qos.logback.core.Context;
import com.aiverse.logging.AiverseEnv;
import io.opentelemetry.api.common.AttributeKey;
import io.opentelemetry.api.common.Attributes;
import io.opentelemetry.exporter.otlp.http.logs.OtlpHttpLogRecordExporter;
import io.opentelemetry.sdk.logs.SdkLoggerProvider;
import io.opentelemetry.sdk.logs.export.BatchLogRecordProcessor;
import io.opentelemetry.sdk.resources.Resource;

import java.util.Base64;

public final class AiverseOtelLogging {
    private AiverseOtelLogging() {}

    public static SdkLoggerProvider createLoggerProvider(Context context) {
        String endpoint = requiredEnv(context, "GRAFANA_OTLP_ENDPOINT");
        String username = requiredEnv(context, "GRAFANA_OTLP_USERNAME");
        String token = requiredEnv(context, "GRAFANA_OTLP_TOKEN");

        String credentials = Base64.getEncoder().encodeToString((username + ":" + token).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        OtlpHttpLogRecordExporter exporter = OtlpHttpLogRecordExporter.builder()
                        .setEndpoint(endpoint)
                        .addHeader("Authorization", "Basic " + credentials)
                        .build();
        Resource resource = Resource.getDefault().merge(Resource.create(Attributes.of(
                        AttributeKey.stringKey("service.name"),
                        AiverseEnv.get(context, "OTEL_SERVICE_NAME", "unknown_service"),
                        AttributeKey.stringKey("service.namespace"),
                        AiverseEnv.get(context, "OTEL_SERVICE_NAMESPACE", "aiverse"),
                        AttributeKey.stringKey("service.version"),
                        AiverseEnv.get(context, "AIVERSE_SERVICE_VERSION", "0.1.0"),
                        AttributeKey.stringKey("deployment.environment.name"),
                        AiverseEnv.get(context, "OTEL_DEPLOYMENT_ENVIRONMENT",
                        AiverseEnv.get(context, "AIVERSE_ENVIRONMENT", "development")))));

        return SdkLoggerProvider.builder()
                .setResource(resource)
                .addLogRecordProcessor(BatchLogRecordProcessor.builder(exporter).build())
                .build();
    }

    private static String requiredEnv(Context context, String key) {
        String value = AiverseEnv.get(context, key);
        if (value == null) {
            throw new IllegalStateException("Missing required environment variable: " + key);
        }
        return value;
    }
}
