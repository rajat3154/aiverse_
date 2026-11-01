package com.aiverse.logging;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnWebApplication;
import org.springframework.context.annotation.Bean;

@AutoConfiguration
@ConditionalOnClass(AiverseRequestContextFilter.class)
@ConditionalOnWebApplication(type = ConditionalOnWebApplication.Type.SERVLET)
public class AiverseLoggingAutoConfiguration {
    @Bean
    @ConditionalOnMissingBean(AiverseRequestContextFilter.class)
    public AiverseRequestContextFilter aiverseRequestContextFilter() {
        return new AiverseRequestContextFilter();
    }
}
