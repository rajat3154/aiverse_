import { aiApi } from "./integrationService";

// MCP Toolbox: the database sources come from the shared tool catalog (provider "mcp_toolbox"); saved connections have
// their own endpoints. The server never sends secret values back, only the names of the secret fields that are saved.
const PROVIDER_KEY = "mcp_toolbox";
const CONNECTIONS = "/database-connections";

const json = (method, body) => ({ method, body: JSON.stringify(body ?? {}) });

const toSource = (item) => ({
  id: item.id,
  slug: item.slug,
  name: item.name,
  description: item.description,
  category: item.category,
  toolkitLogo: item.display?.logo ?? null,
  metadata: item.display ?? null,
  inputCount: item.parameter_count ?? 0,
  requiredInputCount: (item.required_parameters ?? []).length,
});

// JSON schema -> [{ name, type: "string" | "integer" | "secret", required, default }]
const toFields = (schema) => {
  const required = new Set(schema?.required ?? []);
  return Object.entries(schema?.properties ?? {}).map(([name, definition]) => ({
    name,
    type: definition.format === "password" ? "secret" : definition.type === "integer" ? "integer" : "string",
    required: required.has(name),
    default: definition.default,
  }));
};

const toConnection = (item) => ({
  id: item.id,
  name: item.name,
  slug: item.slug,
  configuration: item.configuration ?? {},
  savedSecretFields: item.saved_secret_fields ?? [],
  createdAt: item.created_at,
  updatedAt: item.updated_at,
});

/** Every database source of the MCP Toolbox catalog. */
export const listDatabaseSources = async () => {
  const data = await aiApi(`/tools/catalog?provider_key=${PROVIDER_KEY}&page_size=200`);
  return (data?.items ?? []).map(toSource);
};

/** One source with the fields needed to connect to it. */
export const getDatabaseSource = async (toolId) => {
  const tool = await aiApi(`/tools/${encodeURIComponent(toolId)}`);
  return { inputParameters: toFields(tool.input_schema), metadata: tool.tool_metadata ?? null };
};

export const getDatabaseConnections = async () => ((await aiApi(CONNECTIONS)) ?? []).map(toConnection);

export const createDatabaseConnection = async (body) => toConnection(await aiApi(CONNECTIONS, json("POST", body)));

export const updateDatabaseConnection = async (id, body) => toConnection(await aiApi(`${CONNECTIONS}/${encodeURIComponent(id)}`, json("PUT", body)));

export const deleteDatabaseConnection = (id) => aiApi(`${CONNECTIONS}/${encodeURIComponent(id)}`, { method: "DELETE" });

/** Tries the connection without saving it. When editing, pass connectionId so blank secrets use the saved ones. */
export const testDatabaseConnection = async ({ slug, configuration, connectionId }) => {
  const result = await aiApi(`${CONNECTIONS}/test`, json("POST", { slug, configuration, connection_id: connectionId ?? null }));
  return { success: result.success, message: result.message, errorCode: result.error_code, latencyMs: result.latency_ms };
};
