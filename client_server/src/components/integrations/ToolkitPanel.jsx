import { useCallback, useEffect, useState } from "react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { listTools, refreshToolkit } from "../../services/integrationService";
import { formatTime } from "./format";
import { TOOL_SORTS } from "./sorting";
import { getStyles, STATUS_LABELS } from "./styles";
import ToolRunner from "./ToolRunner";
import { Chip, Skeleton, StatusDot, ToolkitLogo } from "./ui";

const PAGE_SIZE = 50;

// Full-height panel for one toolkit: account + auth on the left, tool browser and runner on the right.
// Mount with key={toolkit.slug} so each toolkit starts from a clean state.
export default function ToolkitPanel({ toolkit, connections, busy, isLight, onClose, onConnect, onDisconnect }) {
  const styles = getStyles(isLight);
  const [toolSearch, setToolSearch] = useState("");
  const [sortId, setSortId] = useState("name-asc");
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState({ key: null, items: [], total: 0, page: 0, totalPages: 0, error: "" });
  const [loadingMore, setLoadingMore] = useState(false);
  const [entered, setEntered] = useState(false);
  const [toolEntered, setToolEntered] = useState(false); // slide-in of the tool sidebar
  // Loading this app's tools from the provider happens on demand, at most once a day (the server decides).
  const [refresh, setRefresh] = useState({ state: "loading", status: null, syncedAt: toolkit.synced_at, counts: null, message: "" });
  const [reloadKey, setReloadKey] = useState(0);
  const debouncedSearch = useDebouncedValue(toolSearch.trim(), 300);
  const key = `${toolkit.slug}|${debouncedSearch}|${reloadKey}`;

  // First page for the current search. The previous result stays visible until the new one arrives.
  useEffect(() => {
    let cancelled = false;
    listTools(toolkit.slug, { provider: toolkit.provider_key, search: debouncedSearch || undefined, page: 1, pageSize: PAGE_SIZE })
      .then((data) => !cancelled && setResult({ key, items: data.items ?? [], total: data.total ?? 0, page: 1, totalPages: data.total_pages ?? 1, error: "" }))
      .catch((e) => !cancelled && setResult({ key, items: [], total: 0, page: 1, totalPages: 1, error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [toolkit.slug, toolkit.provider_key, debouncedSearch, key]);

  const runRefresh = useCallback(
    async (force) => {
      setRefresh((current) => ({ ...current, state: "loading", message: "" }));
      try {
        const outcome = await refreshToolkit(toolkit.slug, { force, provider: toolkit.provider_key });
        setRefresh({ state: "done", status: outcome.status, syncedAt: outcome.synced_at, counts: outcome.counts, message: "" });
        if (outcome.status !== "fresh") setReloadKey((n) => n + 1); // new data arrived: show it
      } catch (e) {
        setRefresh((current) => ({
          ...current,
          state: "error",
          message: e.status === 429 && e.retryAfter ? `The provider is busy. Try again in ${e.retryAfter}s.` : e.message,
        }));
      }
    },
    [toolkit.slug, toolkit.provider_key],
  );

  // Opening an app loads its tools once; the list below shows whatever is stored while that runs.
  useEffect(() => {
    const timer = setTimeout(() => runRefresh(false), 0);
    return () => clearTimeout(timer);
  }, [runRefresh]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const data = await listTools(toolkit.slug, { provider: toolkit.provider_key, search: debouncedSearch || undefined, page: result.page + 1, pageSize: PAGE_SIZE });
      setResult((current) => ({ ...current, items: [...current.items, ...(data.items ?? [])], page: current.page + 1, totalPages: data.total_pages ?? current.totalPages }));
    } catch (e) {
      setResult((current) => ({ ...current, error: e.message }));
    } finally {
      setLoadingMore(false);
    }
  }, [toolkit.slug, toolkit.provider_key, debouncedSearch, result.page]);

  // Slide in on the next frame, like the LLM provider drawer.
  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Slide the tool sidebar in on the next frame whenever a tool is opened; reset when it closes.
  useEffect(() => {
    if (!selected) return undefined;
    const frame = requestAnimationFrame(() => setToolEntered(true));
    return () => {
      cancelAnimationFrame(frame);
      setToolEntered(false);
    };
  }, [selected]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (selected) setSelected(null); // close the tool dialog first, the panel on the next press
      else onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, selected]);

  const mine = connections.filter((c) => c.toolkit?.slug === toolkit.slug);
  const activeAccounts = mine.filter((c) => c.status === "ACTIVE");
  const active = activeAccounts.length > 0;
  const loadingTools = result.key !== key;
  const sortedTools = [...result.items].sort(TOOL_SORTS.find((option) => option.id === sortId).compare);
  const schemes = toolkit.auth_schemes ?? [];
  const noAuth = toolkit.no_auth || (schemes.length === 1 && schemes[0] === "NO_AUTH");

  return (
    <div className="fixed inset-0 z-[60]" role="presentation">
      <div className={`absolute inset-0 bg-black/45 transition-opacity duration-200 ${entered ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${toolkit.name} integration`}
        className={`scrollable absolute inset-y-0 right-0 flex w-full max-w-5xl flex-col overflow-y-auto overscroll-contain border-l shadow-2xl outline-none transition-transform duration-200 ease-out md:flex-row md:overflow-hidden ${
          entered ? "translate-x-0" : "translate-x-full"
        } ${isLight ? "border-[#E5E4E7] bg-white text-gray-900" : "border-[#263241]/60 bg-black text-white"}`}
      >
        {/* Left: who/what/auth */}
        <div className={`scrollable flex flex-col gap-5 border-b p-5 md:w-80 md:shrink-0 md:overflow-y-auto md:border-b-0 md:border-r ${styles.line}`}>
          <div className="flex items-start justify-between gap-3">
            <ToolkitLogo toolkit={toolkit} isLight={isLight} size="lg" />
            <button type="button" className={styles.button} onClick={onClose} aria-label="Close">✕</button>
          </div>
          <div>
            <h2 className="m-0 text-[16px] font-semibold leading-tight">{toolkit.name}</h2>
            <div className="mt-1.5">
              {noAuth ? <span className={`text-xs ${styles.muted}`}>No sign-in needed</span> : <StatusDot status={active ? "ACTIVE" : "INACTIVE"} label={active ? "Connected" : "Not connected"} />}
            </div>
            {toolkit.app_url && (
              <a href={toolkit.app_url} target="_blank" rel="noreferrer noopener" className="mt-1 block truncate text-[12px] text-(--accent-readable) hover:underline">
                {toolkit.app_url.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
          {toolkit.description && <p className={`text-sm leading-relaxed ${styles.muted}`}>{toolkit.description}</p>}
          {toolkit.category && <div><Chip className={styles.chip}>{toolkit.category}</Chip></div>}

          <section>
            <p className={`${styles.label} ${styles.muted} mb-2`}>Authentication</p>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {noAuth ? (
                <Chip className={styles.chip}>None required</Chip>
              ) : schemes.length === 0 ? (
                <Chip className={styles.chip}>Provider sign-in</Chip>
              ) : (
                schemes.map((scheme) => <Chip key={scheme} className="bg-(--accent-soft) text-(--accent-readable)">{scheme.replace(/_/g, " ")}</Chip>)
              )}
            </div>
            <p className={`text-xs leading-relaxed ${styles.muted}`}>
              {noAuth
                ? "Works without linking an account."
                : "You sign in on the provider's own page. AIVERSE never sees your password, and credentials stay on the server."}
            </p>
          </section>

          {!noAuth && (
            <section className="flex flex-col gap-2">
              <p className={`${styles.label} ${styles.muted}`}>Accounts</p>
              {mine.map((connection) => (
                <div key={connection.id} className={` border p-3 ${styles.divider}`}>
                  <p className="truncate text-sm font-medium">{connection.alias || `Account ${connection.id.slice(-6)}`}</p>
                  <p className="mt-0.5 text-xs"><StatusDot status={connection.status} label={STATUS_LABELS[connection.status] ?? connection.status} /></p>
                  <p className={`mt-1 text-[11px] ${styles.muted}`}>
                    {connection.updated_at ? `Updated ${formatTime(connection.updated_at)}` : ""}
                    {connection.status_reason && connection.status !== "ACTIVE" ? ` · ${connection.status_reason}` : ""}
                  </p>
                  <button type="button" className={`${styles.danger} mt-2`} disabled={busy === connection.id} onClick={() => onDisconnect(connection, toolkit.name)}>
                    {busy === connection.id ? "Disconnecting…" : "Disconnect"}
                  </button>
                </div>
              ))}
              <button type="button" className={styles.primary} disabled={busy === toolkit.slug} onClick={() => onConnect(toolkit)}>
                {busy === toolkit.slug ? "Redirecting…" : mine.length ? "Connect another account" : "Connect account"}
              </button>
            </section>
          )}
        </div>

        {/* Right: tool browser + runner */}
        <div className="scrollable flex min-w-0 flex-1 flex-col gap-4 p-5 md:overflow-y-auto">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className={`m-0 ${styles.label}`}>
                Tools <span className={styles.muted}>· {loadingTools ? "…" : result.total}</span>
              </h3>
              <p className={`m-0 mt-1 text-[11.5px] ${refresh.state === "error" ? "text-rose-400" : styles.muted}`} aria-live="polite">
                {refresh.state === "loading"
                  ? "Loading this app's tools…"
                  : refresh.state === "error"
                    ? `Could not update: ${refresh.message}`
                    : refresh.status === "fresh"
                      ? `Up to date${refresh.syncedAt ? ` · updated ${formatTime(refresh.syncedAt)}` : ""}`
                      : `Updated just now${refresh.counts ? ` · ${refresh.counts.inserted} new, ${refresh.counts.updated} changed` : ""}`}
                {refresh.state !== "loading" && (
                  <>
                    {" · "}
                    <button type="button" className={styles.link} onClick={() => runRefresh(refresh.state !== "error")}>
                      {refresh.state === "error" ? "Retry" : "Refresh"}
                    </button>
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select value={sortId} onChange={(e) => setSortId(e.target.value)} aria-label="Sort tools" className={`${styles.input} py-1.5 sm:text-xs`}>
                {TOOL_SORTS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
              </select>
              <input
                type="search"
                value={toolSearch}
                onChange={(e) => setToolSearch(e.target.value)}
                placeholder="Search tools"
                aria-label="Search tools"
                className={`${styles.input} w-full py-1.5 sm:w-44 sm:text-xs`}
              />
            </div>
          </div>

          {result.error && <p className={styles.error}>{result.error}</p>}
          {loadingTools && result.items.length === 0 ? (
            <div className="flex flex-col gap-2">{[0, 1, 2, 3].map((n) => <Skeleton key={n} isLight={isLight} className="h-14 w-full" />)}</div>
          ) : result.items.length === 0 ? (
            <p className={`text-sm ${styles.muted}`}>
              {debouncedSearch
                ? "No tools match your search."
                : refresh.state === "loading"
                  ? "Loading this app's tools…"
                  : "This app has no tools available."}
            </p>
          ) : (
            <ul className={`m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 ${loadingTools ? "opacity-60" : ""}`}>
              {sortedTools.map((tool) => {
                const isSelected = selected?.id === tool.id;
                const requiredCount = tool.required_parameters?.length ?? 0;
                return (
                  <li key={tool.id} className="flex">
                    <button
                      type="button"
                      onClick={() => setSelected(tool)}
                      aria-pressed={isSelected}
                      className={`flex w-full cursor-pointer flex-col gap-2 border p-4 text-left text-inherit outline-none transition-colors focus-visible:border-(--accent-color) ${
                        isSelected
                          ? "border-(--accent-color) bg-(--accent-soft)"
                          : `bg-transparent ${styles.divider} ${isLight ? "hover:border-black/20" : "hover:border-white/25"}`
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <ToolkitLogo toolkit={toolkit} isLight={isLight} />
                        <span className={`min-w-0 truncate text-[11px] font-medium uppercase tracking-wider ${styles.muted}`}>{toolkit.name}</span>
                      </span>
                      <span className="line-clamp-2 text-[13.5px] font-semibold leading-snug">{tool.name}</span>
                      <span className={`line-clamp-3 text-[12.5px] leading-relaxed ${styles.body}`}>
                        {tool.description || "No description provided."}
                      </span>
                      <span className={`mt-auto flex items-center justify-between gap-2 pt-1 text-[11.5px] ${styles.muted}`}>
                        <span>{requiredCount} required · {tool.parameter_count ?? 0} input{tool.parameter_count === 1 ? "" : "s"}</span>
                        <span className="font-medium text-(--accent-readable)">{isSelected ? "Selected" : "Open"}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {result.page < result.totalPages && (
            <button type="button" className={`${styles.button} self-start`} disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? "Loading…" : `Show more (${result.total - result.items.length} left)`}
            </button>
          )}
        </div>
      </aside>

      {/* The tool opens in a sidebar on the LEFT edge of the screen, layered over the page and the main menu. It covers
          everything up to where this panel's tools list begins (the app details column stays covered, the tools stay
          visible). On phones it covers the whole screen. The form keeps a readable width inside it. */}
      {selected && (
        <aside
          role="dialog"
          aria-modal="true"
          aria-label={`${selected.name} inputs`}
          className={`fixed inset-y-0 left-0 z-[70] flex w-full flex-col overflow-hidden border-r shadow-2xl outline-none transition-transform duration-200 ease-out md:w-[max(22rem,calc(100vw-(min(100vw,64rem)-20rem)))] ${
            toolEntered ? "translate-x-0" : "-translate-x-full"
          } ${isLight ? "border-[#E5E4E7] bg-white text-gray-900" : "border-[#263241]/60 bg-black text-white"}`}
        >
          <span className="absolute inset-x-0 top-0 z-10 h-0.5" style={{ backgroundImage: "var(--accent-paint)" }} aria-hidden="true" />
          <div className="mx-auto flex h-full min-h-0 w-full max-w-2xl flex-col">
            <ToolRunner key={selected.id} tool={selected} toolkit={toolkit} accounts={activeAccounts} isLight={isLight} onClose={() => setSelected(null)} onConnect={onConnect} />
          </div>
        </aside>
      )}
    </div>
  );
}
