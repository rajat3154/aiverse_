package com.aiverse.spring;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {
    private static final Logger log = LoggerFactory.getLogger(HealthController.class);

    @GetMapping({ "/", "/health" })
    public Map<String, String> health() {
        return Map.of("status", "UP", "service", "spring-server");
    }

}
