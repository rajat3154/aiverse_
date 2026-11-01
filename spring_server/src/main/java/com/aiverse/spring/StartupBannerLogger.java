package com.aiverse.spring;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.MessageSource;
import org.springframework.context.event.EventListener;
import org.springframework.core.env.Environment;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;


@Component
public class StartupBannerLogger {

	private static final Logger log = LoggerFactory.getLogger(StartupBannerLogger.class);
	private final MessageSource messages;
	private final Environment environment;

	public StartupBannerLogger(MessageSource messages, Environment environment) {
		this.messages = messages;
		this.environment = environment;
	}

	@EventListener(ApplicationReadyEvent.class)
	public void logBanner() {
		String port = environment.getProperty("local.server.port", environment.getProperty("server.port", ""));
		log.info(messages.getMessage("system.startup.banner", new Object[] { port, readBanner() }, Locale.getDefault()));
	}

	private String readBanner() {
		try {
			return "\n" + new String(new ClassPathResource("banner.txt").getInputStream().readAllBytes(), StandardCharsets.UTF_8);
		} catch (IOException exception) {
			return "";
		}
	}
}
