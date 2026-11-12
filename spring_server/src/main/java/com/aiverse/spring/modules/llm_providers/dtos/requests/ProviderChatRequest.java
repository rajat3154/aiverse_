package com.aiverse.spring.modules.llm_providers.dtos.requests;

import java.util.List;

public record ProviderChatRequest(List<Message> messages) {
      public record Message(String role, String content) {
            
      }
}
