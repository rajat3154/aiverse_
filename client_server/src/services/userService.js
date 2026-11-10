import { API_ROUTES } from "../config/api";
import { ApiError, authFetch } from "./authService";

const BASE = `${API_ROUTES.identity}/users`;

// The gateway only serves these routes to a MASTER token; anything else comes back 401/403.
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

export const listUsers = () => request("");
export const getUser = (tenantId) => request(`/${tenantId}`);
export const createUser = (body) => request("", { method: "POST", body: JSON.stringify(body) });
export const updateUser = (tenantId, body) => request(`/${tenantId}`, { method: "PATCH", body: JSON.stringify(body) });
export const deleteUser = (tenantId) => request(`/${tenantId}`, { method: "DELETE" });
