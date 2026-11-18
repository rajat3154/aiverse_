import { useCallback, useEffect, useState } from "react";
import { useConfirm } from "../../hooks/useConfirm";
import { getToolsHealth, syncProvider } from "../../services/integrationService";
import { getStyles } from "./styles";

// Two buttons for MASTER accounts, shown under the page heading. The gateway rejects the sync endpoint for everyone else,
// so showing them only to MASTER is convenience, not security.
export default function AdminBar({ isLight, onNotice, onSynced }) {
  const styles = getStyles(isLight);
  const confirm = useConfirm();
  const [health, setHealth] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [probing, setProbing] = useState(false);

  const load = useCallback(async () => {
    try {
      setHealth(await getToolsHealth());
    } catch {
      setHealth(null); // the bar still offers the actions; it just cannot show the status
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const providers = health?.providers ?? [];
  const provider = providers[0];

  const fullSync = async () => {
    const key = provider?.provider_key ?? "composio";
    const ok = await confirm({
      title: `Run a full sync of ${key}?`,
      message: "You usually do not need this: each app's tools load automatically the first time someone opens it and refresh at most once a day. A full sync reads every app at once and can take many minutes. Keep this page open until it finishes.",
      confirmText: "Run full sync",
    });
    if (!ok) return;
    setSyncing(true);
    onNotice({ tone: "info", text: `Full sync of ${key} started. This can take several minutes…` });
    try {
      const result = await syncProvider(key);
      onNotice({
        tone: result.status === "success" ? "success" : "info",
        text: `Full sync ${result.status}: ${result.discovered} tools found, ${result.inserted} new, ${result.updated} updated, ${result.deactivated} deactivated.`,
      });
      onSynced?.();
    } catch (e) {
      onNotice({ tone: "error", text: `Full sync failed: ${e.message}` });
    } finally {
      setSyncing(false);
      load();
    }
  };

  const check = async () => {
    setProbing(true);
    try {
      const result = await getToolsHealth({ probe: true });
      setHealth(result);
      const down = result.providers.find((p) => p.configured === false || p.available === false);
      onNotice(
        down
          ? { tone: "error", text: `${down.provider_key} is ${down.configured === false ? "not configured" : "unavailable"}${down.detail ? `: ${down.detail}` : "."}` }
          : { tone: "success", text: "The tool provider is reachable." },
      );
    } catch (e) {
      onNotice({ tone: "error", text: e.message });
    } finally {
      setProbing(false);
    }
  };

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Administration">
      <button type="button" className={styles.button} disabled={probing || syncing} onClick={check}>
        {probing ? "Checking…" : "Check provider"}
      </button>
      <button type="button" className={styles.primary} disabled={syncing} onClick={fullSync}>
        {syncing ? "Syncing…" : "Full sync"}
      </button>
    </div>
  );
}
