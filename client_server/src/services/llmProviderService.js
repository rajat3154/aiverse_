import { API_ROUTES } from "../config/api";
import { ApiError, authFetch } from "./authService";

const BASE = `${API_ROUTES.identity}/llm-providers`;

const request = async (path, options) => {
  let res;
  try {
    res = await authFetch(`${BASE}${path}`, options);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Unable to reach the server. Check your connection and try again.", 0);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.message || `Request failed (HTTP ${res.status})`, res.status);
  return data;
};

// The catalog is the list of enabled providers the AI Server has loaded and synchronized.
export const listLlmProviders = () => request("");

// Master only (the gateway enforces it). The browser sets the multipart Content-Type itself.
export const uploadProviderLogo = (id, file) => {
  const body = new FormData();
  body.append("file", file);
  return request(`/${id}/logo`, { method: "PUT", body });
};
export const removeProviderLogo = (id) => request(`/${id}/logo`, { method: "DELETE" });

// Live model list from the provider, using one of the caller's own credentials (the key never reaches the browser).
export const listProviderModels = (id, credentialId) => request(`/${id}/models?credentialId=${encodeURIComponent(credentialId)}`);

// Saved configurations of one provider for the signed-in user: several allowed, at most one active.
const configs = (providerId) => `/${providerId}/configurations`;
export const listProviderConfigurations = (providerId) => request(configs(providerId));
export const createProviderConfiguration = (providerId, body) => request(configs(providerId), { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
export const updateProviderConfiguration = (providerId, id, body) =>
  request(`${configs(providerId)}/${id}`, { method: "PUT", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });
export const activateProviderConfiguration = (providerId, id) => request(`${configs(providerId)}/${id}/activate`, { method: "POST" });
export const deleteProviderConfiguration = (providerId, id) => request(`${configs(providerId)}/${id}`, { method: "DELETE" });

// Test chat: the reply is generated with the configuration's credential, model and settings.
export const chatWithProviderConfiguration = (providerId, id, messages) =>
  request(`${configs(providerId)}/${id}/chat`, { method: "POST", body: JSON.stringify({ messages }), headers: { "Content-Type": "application/json" } });
