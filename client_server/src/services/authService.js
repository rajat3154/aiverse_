import { API_BASE_URL, API_ROUTES } from "../config/api";

const SESSION_KEY = "aiverse.session";
const NETWORK_ERROR = "Unable to reach the server. Check your connection and try again.";

/** An error carrying the message the gateway sent, safe to show to the user. */
export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

// ---- session storage -------------------------------------------------------

export const getSession = () => {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
  } catch {
    return null;
  }
};

const saveSession = (session) => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // storage unavailable (private mode / quota): the session just won't survive a reload
  }
};

export const clearSession = () => {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // nothing to clear
  }
};

export const isAuthenticated = () => Boolean(getSession()?.refreshToken);

// ---- requests --------------------------------------------------------------

const post = async (path, body) => {
  let res;
  try {
    res = await fetch(`${API_BASE_URL ?? ""}${API_ROUTES.auth}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError(NETWORK_ERROR, 0); // fetch rejects when the gateway cannot be reached
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.message || `Request failed (HTTP ${res.status})`, res.status);
  return data;
};

const toSession = (data, previous) => ({
  accessToken: data.accessToken,
  refreshToken: data.refreshToken,
  // refresh a little early so a request never goes out with a token about to expire
  accessExpiresAt: Date.now() + data.expiresIn * 1000 - 10_000,
  user: previous?.user ??
    data.user ?? {
      tenantId: data.tenantId,
      email: data.email,
      username: data.username,
      role: data.role,
    },
});

/** Where the browser goes to start a Google/GitHub sign-in. The gateway runs the whole OAuth round trip. */
export const oauthLoginUrl = (provider) => `${API_BASE_URL ?? ""}/oauth2/authorization/${provider}`;

/** Trades the one-time code from the OAuth redirect for AIVERSE tokens and starts the session. */
export const exchangeOAuthCode = async (code) => {
  const session = toSession(await post("/oauth/exchange", { code }));
  saveSession(session);
  return session;
};

export const login = async (identifier, password) => {
  const data = await post("/login", { identifier: identifier.trim(), password });
  const session = toSession(data);
  saveSession(session);
  return session;
};

// Several requests can notice an expired token at once; they must share one refresh because each refresh token is single-use.
let refreshing = null;

export const refreshSession = () => {
  refreshing ??= (async () => {
    const current = getSession();
    if (!current?.refreshToken) throw new ApiError("Your session has expired. Please sign in again.", 401);
    try {
      const session = toSession(await post("/refresh", { refreshToken: current.refreshToken }), current);
      saveSession(session);
      return session;
    } catch (error) {
      if (error.status === 401) clearSession(); // refresh token rejected: the session is over
      throw error;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
};

export const logout = async () => {
  const session = getSession();
  clearSession(); // sign out locally even if the server call fails
  if (!session?.refreshToken) return;
  try {
    await post("/logout", { refreshToken: session.refreshToken });
  } catch {
    // the refresh token expires on its own; nothing more the user can do
  }
};

/** fetch() for protected endpoints: adds the access token and renews it once when it has expired. */
export const authFetch = async (path, options = {}) => {
  let session = getSession();
  if (!session) throw new ApiError("Please sign in to continue.", 401);
  if (Date.now() >= session.accessExpiresAt) session = await refreshSession();

  const send = (token) =>
    fetch(`${API_BASE_URL ?? ""}${path}`, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` },
    });

  let res = await send(session.accessToken);
  if (res.status === 401) {
    session = await refreshSession();
    res = await send(session.accessToken);
  }
  return res;
};
