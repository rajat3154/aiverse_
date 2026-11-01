package com.aiverse.spring;

import java.util.Map;

import org.flowable.engine.RepositoryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

	private static final Logger log = LoggerFactory.getLogger(HealthController.class);

	private final RepositoryService repositoryService;

	public HealthController(RepositoryService repositoryService) {
		this.repositoryService = repositoryService;
	}

	@GetMapping({ "/", "/health" })
	public Map<String, Object> health() {
		try {
			return Map.of(
					"status", "UP",
					"service", "flowable-server",
					"deployedProcesses", repositoryService.createProcessDefinitionQuery().count());
		} catch (RuntimeException exception) {
			log.error("Flowable health check failed: unable to query process definitions", exception);
			throw exception;
		}
	}

}
