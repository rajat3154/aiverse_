import { API_ROUTES } from "../config/api";
import { ApiError, authFetch, clearSession } from "./authService";

// Every call goes through the gateway (JWT checked there, identity stamped on the request). The browser never sends a
// user id and never sees provider credentials.
const TOOLS = `${API_ROUTES.ai}/api/tools`;
const INTEGRATIONS = `${API_ROUTES.ai}/api/integrations`;

/**
 * @typedef {Object} Toolkit
 * @property {string} slug            toolkit key, e.g. "github" (matches connection.toolkit.slug)
 * @property {string} name
 * @property {string|null} description
 * @property {string|null} logo
 * @property {string|null} app_url
 * @property {string|null} category
 * @property {string[]} categories
 * @property {number} tools_count
 * @property {string[]} auth_schemes
 * @property {boolean} no_auth
 *
 * @typedef {Object} Connection
 * @property {string} id
 * @property {"ACTIVE"|"INITIATED"|"INITIALIZING"|"FAILED"|"EXPIRED"|"INACTIVE"|"REVOKED"} status
 * @property {string|null} status_reason
 * @property {string|null} alias
 * @property {{ slug: string }} toolkit
 * @property {string} created_at
 * @property {string} updated_at
 *
 * @typedef {Object} Tool
 * @property {string} id
 * @property {string} slug
 * @property {string} name
 * @property {string|null} description
 * @property {string|null} toolkit_key
 * @property {boolean} requires_connection
 * @property {string[]} required_parameters
 * @property {number} parameter_count
 * @property {{ required?: string[], properties?: Object }} [input_schema] only on getTool()
 */

// Tools API errors are { detail: { code, message, ...extra } }; the connection endpoints use { detail: "text" }.
const describeError = (status, data) => {
  const detail = data?.detail;
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    return { message: detail.message || `Request failed (HTTP ${status})`, code: detail.code ?? null, details: detail };
  }
  if (Array.isArray(detail)) {
    // FastAPI validation errors: [{ loc, msg }]
    return { message: detail.map((item) => item.msg).filter(Boolean).join("; ") || "Invalid request", code: "validation_error", details: null };
  }
  if (typeof detail === "string" && detail) return { message: detail, code: null, details: null };
  const fallback =
    {
      404: "That item no longer exists.",
      429: "Too many requests. Please wait a moment and try again.",
      502: "The integration service is unavailable right now. Try again shortly.",
      503: "The integration service is unavailable right now. Try again shortly.",
      504: "The integration service took too long to answer. Try again shortly.",
    }[status] ?? `Request failed (HTTP ${status})`;
  return { message: fallback, code: null, details: null };
};

const request = async (base, path, options = {}) => {
  let res;
  try {
    res = await authFetch(`${base}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Unable to reach the server. Check your connection and try again.", 0);
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.status === 401) {
    // authFetch already tried to refresh the token, so the session really is over
    clearSession();
    window.location.replace("/login");
  }
  if (!res.ok) {
    const { message, code, details } = describeError(res.status, data);
    const error = new ApiError(message, res.status);
    error.code = code;
    error.details = details;
    error.retryAfter = Number(res.headers.get("Retry-After")) || details?.retry_after || null;
    throw error;
  }
  return data;
};

/** Any AI-server endpoint under /api, for features that have their own module (e.g. database connections). */
export const aiApi = (path, options) => request(`${API_ROUTES.ai}/api`, path, options);

const tools = (path, options) => request(TOOLS, path, options);
const integrations = (path, options) => request(INTEGRATIONS, path, options);

const query = (params) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  const text = search.toString();
  return text ? `?${text}` : "";
};

const post = (body) => ({ method: "POST", body: JSON.stringify(body ?? {}) });

// ---- catalog -------------------------------------------------------------------------------------------------------

const toToolkit = (item) => ({
  slug: item.toolkit_key,
  provider_key: item.provider_key,
  name: item.name || item.toolkit_key,
  description: item.description ?? null,
  logo: item.logo ?? null,
  app_url: item.app_url ?? null,
  category: item.category ?? null,
  categories: item.category ? [item.category] : [],
  tools_count: item.tool_count ?? 0,
  auth_schemes: item.auth_schemes ?? [],
  no_auth: Boolean(item.no_auth),
  synced: item.synced !== false,
  synced_at: item.synced_at ?? null,
});

/** Tool providers known to the server, e.g. [{ provider_key: "composio", name: "Composio", last_synced_at }]. */
export const listProviders = () => tools("/providers");

/** Toolkits that have tools in the catalog (empty until an administrator runs a catalog sync). @returns {Promise<Toolkit[]>} */
export const listToolkits = async ({ search, provider } = {}) => {
  const data = await tools(`/toolkits${query({ search, provider_key: provider })}`);
  return (Array.isArray(data) ? data : []).map(toToolkit);
};

/**
 * Loads one app's tools on demand. Safe to call every time an app is opened: the server only contacts the provider when
 * the stored tools are missing or a day old (15 minutes for `force`), otherwise it answers { status: "fresh" } at once.
 * Resolves to { status: "fresh"|"success"|"partial", synced_at, next_refresh_at, counts }.
 */
export const refreshToolkit = (toolkitKey, { force = false, provider } = {}) =>
  tools(`/toolkits/${encodeURIComponent(toolkitKey)}/refresh${query({ provider_key: provider })}`, post({ force }));

/** Tools of one toolkit, paginated and searched on the server. @returns {Promise<{items: Tool[], total: number, page: number, total_pages: number}>} */
export const listTools = (toolkitKey, { provider, search, page = 1, pageSize = 50, sort = "name", order = "asc" } = {}) =>
  tools(`/catalog${query({ provider_key: provider, toolkit_key: toolkitKey, search, page, page_size: pageSize, sort, order })}`);

/** One tool including its JSON input schema. */
export const getTool = (toolId) => tools(`/${encodeURIComponent(toolId)}`);

// ---- running tools -------------------------------------------------------------------------------------------------

/**
 * Runs a tool for real. `connectedAccountId` is optional: the server picks the user's only active account, answers 400
 * `connection_required` if there is none, and 409 `ambiguous_connection` (with `error.details.candidates`) if several.
 * Resolves to { success, data, error, metadata }. A tool-level failure is success:false, not a thrown error.
 */
export const executeTool = (toolId, args, connectedAccountId, credentialId) =>
  tools("/execute", post({ tool_id: toolId, arguments: args, connected_account_id: connectedAccountId || null, credential_id: credentialId || null }));

/** Dry run by default: validates the tool, arguments and account without running anything. `live: true` also runs it. */
export const testTool = (toolId, args, connectedAccountId, { live = false, credentialId } = {}) =>
  tools(`/${encodeURIComponent(toolId)}/test`, post({ arguments: args, connected_account_id: connectedAccountId || null, credential_id: credentialId || null, live }));

/** The signed-in user's recent runs across all tools. */
export const listMyRuns = ({ page = 1, pageSize = 20, status, mode, toolId } = {}) =>
  tools(`/history${query({ page, page_size: pageSize, status, mode, tool_id: toolId })}`);

// ---- connected accounts --------------------------------------------------------------------------------------------

/** The signed-in user's connected accounts: { items: Connection[] }. */
export const listConnections = () => integrations("/connections");

/** One connection's status. Poll this after returning from the provider's authorization page. */
export const getConnection = (id) => integrations(`/connections/${encodeURIComponent(id)}`);

/** Starts linking a toolkit. Returns { id, status, redirect_url }: send the browser to redirect_url. */
export const startConnection = (toolkit) =>
  integrations("/connections", post({ toolkit, callback_url: `${window.location.origin}/integrations` }));

export const revokeConnection = (id) => integrations(`/connections/${encodeURIComponent(id)}`, { method: "DELETE" });

// ---- administration (MASTER only; the gateway enforces it) --------------------------------------------------------

/** Provider health: { status, providers: [{ provider_key, configured, available, last_synced_at, ... }], scheduler }. */
export const getToolsHealth = ({ probe = false } = {}) => tools(`/health${query({ probe: probe || undefined })}`);

/** Reads the provider's whole catalog into the database. Slow (minutes). Resolves to { discovered, inserted, ... }. */
export const syncProvider = (providerKey, { allowEmptyCatalog = false } = {}) =>
  tools(`/providers/${encodeURIComponent(providerKey)}/sync`, post({ allow_empty_catalog: allowEmptyCatalog }));

export const listSyncHistory = ({ page = 1, pageSize = 10, providerKey } = {}) =>
  tools(`/sync/history${query({ page, page_size: pageSize, provider_key: providerKey })}`);

export const listAuthConfigs = () => integrations("/auth-configs");
export const getAuthConfig = (id) => integrations(`/auth-configs/${encodeURIComponent(id)}`);
