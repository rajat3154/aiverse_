package com.aiverse.spring;

import java.util.Map;

import org.flowable.engine.RepositoryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController {

	private final RepositoryService repositoryService;

	public HealthController(RepositoryService repositoryService) {
		this.repositoryService = repositoryService;
	}

	@GetMapping({ "/", "/health" })
	public Map<String, Object> health() {
		return Map.of(
				"status", "UP",
				"service", "flowable-server",
				"deployedProcesses", repositoryService.createProcessDefinitionQuery().count());
	}

}
