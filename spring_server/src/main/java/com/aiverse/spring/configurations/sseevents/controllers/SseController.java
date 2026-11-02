package com.aiverse.spring.configurations.sseevents.controllers;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.aiverse.spring.configurations.sseevents.configuration.SseConfiguration;

@RestController
@RequestMapping("/api/sse")
public class SseController {

      private final SseConfiguration sseConfiguration;

      public SseController(SseConfiguration sseConfiguration) {
            this.sseConfiguration = sseConfiguration;
      }

      @GetMapping(value = "/connect/{clientId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
      public SseEmitter connect(@PathVariable String clientId) {
            return sseConfiguration.connect(clientId);
      }

      @GetMapping("/connections")
      public int getConnectionCount() {
            return sseConfiguration.getConnectionCount();
      }
}
