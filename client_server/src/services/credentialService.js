import { API_ROUTES } from "../config/api";
import { ApiError, authFetch } from "./authService";

const BASE = `${API_ROUTES.identity}/credentials`;

// The gateway identifies the caller from the access token, so these calls only ever see the signed-in user's own
// credentials. The secret goes up on create/update and is never sent back.
const request = async (path, options = {}) => {
  let res;
  try {
    res = await authFetch(`${BASE}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Unable to reach the server. Check your connection and try again.", 0);
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.message || `Request failed (HTTP ${res.status})`, res.status);
  return data;
};

export const listCredentials = () => request("");
export const createCredential = (body) => request("", { method: "POST", body: JSON.stringify(body) });
export const updateCredential = (id, body) => request(`/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteCredential = (id) => request(`/${id}`, { method: "DELETE" });
