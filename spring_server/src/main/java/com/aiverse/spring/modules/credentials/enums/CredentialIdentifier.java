package com.aiverse.spring.modules.credentials.enums;

public enum CredentialIdentifier {
      GROQ_API_KEY,
      OPENAI_API_KEY,
      ANTHROPIC_API_KEY,
      GEMINI_API_KEY,
      OPENROUTER_API_KEY,
      NVIDIA_NIM_API_KEY,
      COHERE_API_KEY,
      MISTRAL_API_KEY,
      DEEPSEEK_API_KEY,
      TOGETHER_AI_API_KEY,
      PERPLEXITY_API_KEY,
      XAI_API_KEY,
      SARVAM_API_KEY,
      YOUTUBE_API_KEY,

      // OAuth clients
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GITHUB_CLIENT_ID,
      GITHUB_CLIENT_SECRET,
      GITLAB_CLIENT_ID,
      GITLAB_CLIENT_SECRET,
      MICROSOFT_CLIENT_ID,
      MICROSOFT_CLIENT_SECRET,

      // Mail and databases
      SMTP_USERNAME,
      SMTP_PASSWORD,
      POSTGRESQL_USERNAME,
      POSTGRESQL_PASSWORD,
      MYSQL_USERNAME,
      MYSQL_PASSWORD,

      // Generic secrets
      WEBHOOK_SECRET,
      ACCESS_TOKEN,
      REFRESH_TOKEN,
      SERVICE_TOKEN,
      GENERIC_SECRET,

      // Observability
      LANGSMITH_API_KEY,
      LANGFUSE_PUBLIC_KEY,
      LANGFUSE_SECRET_KEY,
      ARIZE_PHOENIX_API_KEY,
      NOVEUM_API_KEY
}
