import { useCallback, useEffect, useRef, useState } from "react";
import { getConnection, listConnections, revokeConnection, startConnection } from "../services/integrationService";

// Remembers the connection being authorized while the browser is away on the provider's page.
const PENDING_KEY = "aiverse.pendingConnection";
const POLL_MS = 2000;
const POLL_LIMIT_MS = 90_000;
const FINAL_STATES = ["ACTIVE", "FAILED", "EXPIRED", "INACTIVE", "REVOKED"];

const readPending = () => {
  try {
    return sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
};
const writePending = (id) => {
  try {
    if (id) sessionStorage.setItem(PENDING_KEY, id);
    else sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // storage unavailable: the page just won't resume after the redirect
  }
};

/**
 * The signed-in user's connected accounts plus the OAuth connect / disconnect flows.
 * `confirm` is the app-wide confirmation dialog (see useConfirm).
 */
export function useIntegrationConnections(confirm) {
  const [connections, setConnections] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null); // toolkit slug or connection id with a request in flight
  const [notice, setNotice] = useState(() =>
    readPending() ? { tone: "info", text: "Finishing your connection…" } : null,
  ); // { tone: "success" | "error" | "info", text }
  const pollTimer = useRef(null);

  const refresh = useCallback(async () => {
    const data = await listConnections();
    setConnections(data?.items ?? []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    listConnections()
      .then((data) => !cancelled && setConnections(data?.items ?? []))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // Back from the provider's authorization page: poll until the connection settles.
  useEffect(() => {
    const pendingId = readPending();
    if (!pendingId) return undefined;
    let cancelled = false;
    const startedAt = Date.now();

    const finish = (tone, text) => {
      writePending(null);
      window.history.replaceState(null, "", "/integrations"); // drop ?status=… added by the provider
      setNotice({ tone, text });
      refresh().catch(() => {});
    };

    const poll = async () => {
      if (cancelled) return;
      try {
        const connection = await getConnection(pendingId);
        if (cancelled) return;
        if (connection.status === "ACTIVE") return finish("success", "Account connected.");
        if (FINAL_STATES.includes(connection.status)) {
          return finish("error", connection.status_reason || "Authorization was not completed. You can try again.");
        }
      } catch (e) {
        if (cancelled) return;
        if (e.status === 404) return finish("error", "That connection could not be found. Please try again.");
        // transient failure (rate limit, network): keep polling until the time limit
      }
      if (Date.now() - startedAt > POLL_LIMIT_MS) {
        return finish("error", "Authorization is taking too long. Check My Connections or try again.");
      }
      pollTimer.current = setTimeout(poll, POLL_MS);
    };
    poll();
    return () => {
      cancelled = true;
      clearTimeout(pollTimer.current);
    };
  }, [refresh]);

  const connect = useCallback(async (toolkit) => {
    setBusy(toolkit.slug);
    setNotice(null);
    try {
      const started = await startConnection(toolkit.slug);
      if (!started?.redirect_url) throw new Error("The provider did not return an authorization link.");
      writePending(started.id);
      window.location.assign(started.redirect_url);
    } catch (e) {
      setBusy(null);
      setNotice({
        tone: "error",
        text: e.status === 429 && e.retryAfter ? `Too many requests. Try again in ${e.retryAfter}s.` : e.message,
      });
    }
  }, []);

  const disconnect = useCallback(
    async (connection, displayName) => {
      const name = displayName || "this account";
      const confirmed = await confirm({
        title: `Disconnect ${name}?`,
        message: "AIVERSE and your agents will lose access to this account. You can connect it again later.",
        confirmText: "Disconnect",
        tone: "danger",
      });
      if (!confirmed) return;
      setBusy(connection.id);
      try {
        await revokeConnection(connection.id);
        setConnections((current) => current.filter((c) => c.id !== connection.id));
        setNotice({ tone: "success", text: `${name} disconnected.` });
      } catch (e) {
        setNotice({ tone: "error", text: e.message });
      } finally {
        setBusy(null);
      }
    },
    [confirm],
  );

  return { connections, loaded, error, busy, notice, setNotice, connect, disconnect, refresh };
}
