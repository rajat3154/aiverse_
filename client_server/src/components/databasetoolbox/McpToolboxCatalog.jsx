import { useEffect, useMemo, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useConfirm } from "../../hooks/useConfirm";
import { formatTime } from "../integrations/format";
import MarketplaceTab from "../integrations/MarketplaceTab";
import { getStyles } from "../integrations/styles";
import { EmptyState, Skeleton, ToolkitLogo } from "../integrations/ui";
import {
  createDatabaseConnection,
  deleteDatabaseConnection,
  getDatabaseConnections,
  getDatabaseSource,
  listDatabaseSources,
  testDatabaseConnection,
  updateDatabaseConnection,
} from "../../services/databaseToolboxService";

// ---------- Icons ----------
const Svg = ({ children, size = 16, sw = 1.6 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}>{children}</svg>
);
const CloseIcon = () => <Svg size={14} sw={2}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Svg>;

const categoryOf = (tool) => tool.category || "other";
// "serviceName" -> "service Name", "connection_string" -> "connection string"
const labelOf = (key) => key.replace(/_/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2");

// ---------- Small components (same look as LlmProviders) ----------
function SourceLogo({ src, name, size = "w-9 h-9", isLight }) {
  const [failed, setFailed] = useState(false);
  const hue = [...(name || "?")].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 360;
  const showImage = src && !failed;
  return (
    <span
      className={`${size} flex items-center justify-center shrink-0 overflow-hidden text-base font-bold border ${
        showImage ? (isLight ? "bg-white border-black/10" : "bg-white/95 border-white/10") : "border-transparent"
      }`}
      style={showImage ? undefined : { background: `hsl(${hue} 55% ${isLight ? 90 : 25}%)`, color: `hsl(${hue} 60% ${isLight ? 35 : 80}%)` }}
    >
      {showImage ? (
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="w-full h-full object-contain p-1.5" />
      ) : (
        (name || "?").charAt(0).toUpperCase()
      )}
    </span>
  );
}

// ---------- Connection form modal ----------
function FieldInput({ field, value, onChange, isLight, placeholder, saved = false }) {
  const [reveal, setReveal] = useState(false);
  // Secrets, and any value that was saved as one (e.g. a connection string with a password in it), stay masked.
  const isSecret = field.type === "secret" || saved;
  const inputType = isSecret && !reveal ? "password" : field.type === "integer" || field.type === "number" ? "number" : "text";
  const muted = isLight ? "text-gray-500" : "text-[#566273]";
  return (
    <div className="flex flex-col gap-1.5">
      <span className={`text-[11.5px] font-semibold uppercase tracking-wider ${isLight ? "text-gray-600" : "text-[#8B98A8]"}`}>
        {labelOf(field.name)}
        {field.required && <span className="text-[#FB7185]"> *</span>}
      </span>
      <div className="relative">
        <input
          type={inputType}
          value={value}
          required={field.required}
          autoComplete={isSecret ? "new-password" : "off"}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          data-lpignore="true"
          placeholder={placeholder ?? (field.default !== undefined ? String(field.default) : "")}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-3 py-2 text-[13px] border outline-none transition-colors ${isSecret ? "pr-14" : ""} ${
            isLight ? "bg-white border-black/10 text-gray-900 focus:border-black/25" : "bg-white/3 border-white/10 text-white focus:border-white/25"
          }`}
        />
        {isSecret && (
          <button
            type="button"
            onClick={() => setReveal((r) => !r)}
            className={`absolute right-2 top-1/2 -translate-y-1/2 border-0 bg-transparent cursor-pointer text-[11px] font-semibold uppercase tracking-wide ${muted}`}
          >
            {reveal ? "Hide" : "Show"}
          </button>
        )}
      </div>
    </div>
  );
}

// Full-width inputs for values that are usually long; the rest sit two per row.
const WIDE_FIELD = /host|server|url|uri|endpoint|path|string|address|database|instance/i;

function InfoRow({ label, value, isLight }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-2.5 border-b text-[12.5px] ${isLight ? "border-black/8" : "border-white/8"}`}>
      <span className={isLight ? "text-gray-500" : "text-[#9AA7B6]"}>{label}</span>
      <span className={`font-mono font-medium capitalize text-right ${isLight ? "text-gray-900" : "text-white"}`}>{String(value)}</span>
    </div>
  );
}

function SourceModal({ tool, connection, isLight, onClose, onSaved }) {
  const [fields, setFields] = useState(null);
  const [error, setError] = useState("");
  const [values, setValues] = useState({});
  const [meta, setMeta] = useState(tool.metadata ?? null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connName, setConnName] = useState(connection?.name ?? tool.name);
  const [result, setResult] = useState(null);
  const muted = isLight ? "text-gray-500" : "text-[#9AA7B6]";

  useEffect(() => {
    let cancelled = false;
    getDatabaseSource(tool.id)
      .then((full) => {
        if (cancelled) return;
        const list = Array.isArray(full.inputParameters) ? full.inputParameters : [];
        setFields(list);
        setMeta(full.metadata ?? null);
        const defaults = Object.fromEntries(list.filter((f) => f.default !== undefined).map((f) => [f.name, String(f.default)]));
        const saved = Object.fromEntries(Object.entries(connection?.configuration ?? {}).map(([k, v]) => [k, String(v)]));
        setValues({ ...defaults, ...saved });
      })
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [tool.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Send numbers as numbers and drop empty optional values.
  const buildConfiguration = () =>
    Object.fromEntries(
      (fields ?? [])
        .filter((f) => (values[f.name] ?? "") !== "")
        .map((f) => [f.name, f.type === "integer" || f.type === "number" ? Number(values[f.name]) : values[f.name]]),
    );

  // Any edit invalidates the last test, so Save stays disabled until the new values pass.
  const change = (setter) => (v) => {
    setter(v);
    setResult(null);
  };

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      setResult(await testDatabaseConnection({ slug: tool.slug, configuration: buildConfiguration(), connectionId: connection?.id }));
    } catch (err) {
      setResult({ success: false, message: err.message });
    } finally {
      setTesting(false);
    }
  };

  const save = async () => {
    setSaving(true);
    const body = { name: connName.trim(), slug: tool.slug, configuration: buildConfiguration() };
    try {
      if (connection) await updateDatabaseConnection(connection.id, body);
      else await createDatabaseConnection(body);
      onSaved(connection ? "Connection updated." : "Connection saved.");
    } catch (err) {
      setResult({ success: false, message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const rows = [
    ["Category", categoryOf(tool) && labelOf(categoryOf(tool))],
    ["Default port", meta?.default_port],
    ["Credentials", meta?.requires_secret === undefined ? null : meta.requires_secret ? "Required" : "Not needed"],
    ["Field schema", meta?.configuration_schema_verified === undefined ? null : meta.configuration_schema_verified ? "Verified" : "Unverified"],
    ["Upstream commit", meta?.upstream_commit && String(meta.upstream_commit).slice(0, 7)],
  ].filter(([, v]) => v !== null && v !== undefined && v !== "");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-8 overflow-y-auto" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${tool.name} connection`}
        className={`w-full max-w-4xl border shadow-2xl my-auto max-h-[90vh] overflow-y-auto md:overflow-hidden grid grid-cols-1 md:grid-cols-5 md:grid-rows-[minmax(0,1fr)] ${isLight ? "bg-white border-black/10" : "bg-black border-white/10"}`}
      >
        {/* Left: what this source is */}
        <aside
          className={`md:col-span-2 md:overflow-y-auto p-6 flex flex-col gap-5 border-b md:border-b-0 md:border-r ${isLight ? "border-black/8" : "border-white/8"}`}
          style={{ background: "color-mix(in srgb, var(--accent-color) 7%, transparent)" }}
        >
          <SourceLogo src={tool.toolkitLogo} name={tool.name} size="w-16 h-16" isLight={isLight} />
          <div className="min-w-0">
            <h2 className={`text-xl font-extrabold uppercase tracking-tight m-0 ${isLight ? "text-gray-900" : "text-white"}`}>
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--accent-paint)" }}>{tool.name}</span>
            </h2>
            <div className={`mt-1 text-[12px] font-mono ${muted}`}>{tool.slug}</div>
          </div>
          {tool.description && <p className={`m-0 text-[13px] leading-relaxed ${isLight ? "text-gray-600" : "text-[#B4BFCC]"}`}>{tool.description}</p>}

          {rows.length > 0 && (
            <div className={`border-t ${isLight ? "border-black/8" : "border-white/8"}`}>
              {rows.map(([label, value]) => <InfoRow key={label} label={label} value={value} isLight={isLight} />)}
            </div>
          )}

          {meta?.documentation_url && (
            <a
              href={meta.documentation_url}
              target="_blank"
              rel="noreferrer"
              className="mt-auto text-[12.5px] font-medium text-(--accent-color) hover:underline"
            >
              Read the documentation ↗
            </a>
          )}
        </aside>

        {/* Right: connection form */}
        <section className="md:col-span-3 min-h-0 p-6 flex flex-col">
          <div className="flex items-start justify-between gap-3 mb-5 shrink-0">
            <div>
              <h3 className={`text-base font-bold uppercase tracking-wide m-0 ${isLight ? "text-gray-900" : "text-white"}`}>{connection ? "Edit connection" : "Connection"}</h3>
              <p className={`text-[12px] mt-1 mb-0 ${muted}`}>Fields needed to connect to {tool.name}.</p>
              <p className={`text-[11.5px] mt-1 mb-0 ${muted}`}>🔒 Passwords and keys are encrypted on the server and never shown again.</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className={`w-7 h-7 shrink-0 flex items-center justify-center cursor-pointer border-0 bg-transparent transition-colors ${
                isLight ? "text-gray-400 hover:bg-black/4 hover:text-gray-700" : "text-[#566273] hover:bg-white/5 hover:text-[#B8C4D0]"
              }`}
            >
              <CloseIcon />
            </button>
          </div>

          <form className="grid grid-cols-1 sm:grid-cols-2 gap-4 content-start flex-1 min-h-0 md:overflow-y-auto md:pr-1" onSubmit={(e) => e.preventDefault()}>
            {error && <div className="sm:col-span-2 px-3.5 py-2.5 text-[13px]" style={{ background: "rgba(251,113,133,0.1)", color: "#FB7185" }}>{error}</div>}
            {!error && fields === null && <div className={`sm:col-span-2 text-[13px] ${muted}`}>Loading fields…</div>}
            {fields && fields.length === 0 && (
              <div className={`sm:col-span-2 text-[12.5px] ${muted}`}>Connection fields for this source have not been documented yet.</div>
            )}
            <div className="sm:col-span-2">
              <FieldInput field={{ name: "connection name", type: "string", required: true }} value={connName} onChange={change(setConnName)} isLight={isLight} />
            </div>
            {fields && fields.map((f) => (
              <div key={f.name} className={WIDE_FIELD.test(f.name) ? "sm:col-span-2" : ""}>
                <FieldInput
                  field={f}
                  value={values[f.name] ?? ""}
                  onChange={change((v) => setValues((prev) => ({ ...prev, [f.name]: v })))}
                  placeholder={connection?.savedSecretFields?.includes(f.name) ? "Saved - leave blank to keep" : undefined}
                  saved={Boolean(connection?.savedSecretFields?.includes(f.name))}
                  isLight={isLight}
                />
              </div>
            ))}
          </form>

          {result && (
            <div
              role="status"
              className="mt-5 px-3.5 py-2.5 text-[13px] shrink-0"
              style={
                result.success
                  ? { background: isLight ? "rgba(5,150,105,0.14)" : "rgba(52,211,153,0.12)", color: isLight ? "#065F46" : "#34D399" }
                  : { background: isLight ? "rgba(225,29,72,0.12)" : "rgba(251,113,133,0.1)", color: isLight ? "#9F1239" : "#FB7185" }
              }
            >
              <div className="font-semibold">{result.success ? "Connection successful" : "Connection failed"}{result.latencyMs ? ` · ${result.latencyMs} ms` : ""}</div>
              {result.message && <div className="mt-0.5 break-words">{result.message}</div>}
            </div>
          )}

          <div className="flex justify-end gap-2 mt-6 shrink-0">
            <button
              type="button"
              onClick={runTest}
              disabled={testing || !fields || fields.length === 0}
              className="px-4 py-2 text-[13px] font-semibold border-0 cursor-pointer text-white transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: "var(--accent-paint)" }}
            >
              {testing ? "Testing…" : "Test connection"}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!result?.success || saving || !connName.trim()}
              className={`px-4 py-2 text-[13px] font-semibold border cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                isLight ? "text-gray-900 border-black/20 hover:bg-black/4" : "text-white border-white/25 hover:bg-white/8"
              }`}
            >
              {saving ? "Saving…" : connection ? "Save changes" : "Save connection"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2 text-[13px] font-medium border cursor-pointer transition-colors ${
                isLight ? "text-gray-700 border-black/10 hover:bg-black/4" : "text-[#D3DBE4] border-white/10 hover:bg-white/5"
              }`}
            >
              Close
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------- Page (same layout as the Composio integrations page) ----------
const NOTICE_TONES = {
  success: "bg-emerald-400/10 text-emerald-400",
  error: "bg-rose-400/10 text-rose-400",
};

// Short, non-secret summary of where a saved connection points.
const summarize = (config = {}) =>
  ["host", "server", "url", "uri", "endpoint", "path", "connection_string"]
    .map((k) => config[k])
    .filter(Boolean)
    .map((v) => String(v).replace(/(:\/\/)[^/@\s]*@/, "$1")) // never show user:password@ in a connection string
    .map((v, i) => (i === 0 && config.port ? `${v}:${config.port}` : v))
    .concat(config.database ? [config.database] : [])
    .join(" / ");

function ConnectionsTab({ connections, sourceBySlug, loading, busyId, isLight, onEdit, onDelete, onBrowse }) {
  const styles = getStyles(isLight);
  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((n) => <Skeleton key={n} isLight={isLight} className="h-16 w-full" />)}
      </div>
    );
  }
  if (connections.length === 0) {
    return (
      <EmptyState isLight={isLight} title="No saved connections yet">
        <button type="button" className={`${styles.primary} mt-3`} onClick={onBrowse}>Browse databases</button>
      </EmptyState>
    );
  }
  return (
    <>
      <div className="mb-4">
        <p className={`${styles.label} ${styles.muted}`}>{connections.length} saved connection{connections.length === 1 ? "" : "s"}</p>
      </div>
      <div className={`overflow-x-auto border ${isLight ? "border-black/8" : "border-white/10"}`}>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className={`${isLight ? "bg-black/2 text-gray-500" : "bg-white/5 text-[#AEBBCB]"}`}>
              {["Name", "Source", "Target", "Created", ""].map((heading) => (
                <th key={heading || "actions"} className={`whitespace-nowrap px-4 py-3 ${styles.label}`}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {connections.map((c) => {
              const source = sourceBySlug[c.slug] ?? { slug: c.slug, name: c.slug };
              return (
                <tr key={c.id} className={`border-t align-middle ${styles.divider}`}>
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <ToolkitLogo toolkit={source} isLight={isLight} />
                      <span className="truncate text-sm font-semibold">{c.name}</span>
                    </div>
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 text-[13px] ${styles.body}`}>{source.name}</td>
                  <td className={`max-w-72 truncate px-4 py-3 font-mono text-[12px] ${styles.muted}`}>{summarize(c.configuration) || "-"}</td>
                  <td className={`whitespace-nowrap px-4 py-3 text-xs ${styles.muted}`}>{formatTime(c.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button type="button" className={styles.button} onClick={() => onEdit(c)}>Edit</button>
                      <button type="button" className={styles.danger} disabled={busyId === c.id} onClick={() => onDelete(c)}>
                        {busyId === c.id ? "…" : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function McpToolboxCatalog() {
  const { mainSectionTheme } = useTheme();
  const isLight = mainSectionTheme === "light";
  const styles = getStyles(isLight);
  const confirm = useConfirm();

  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState(null);
  const [editing, setEditing] = useState(null);
  const [tab, setTab] = useState("marketplace");
  const [connections, setConnections] = useState([]);
  const [connectionsLoaded, setConnectionsLoaded] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState(null);

  const loadConnections = () => {
    getDatabaseConnections()
      .then(setConnections)
      .catch((err) => setNotice({ tone: "error", text: err.message }))
      .finally(() => setConnectionsLoaded(true));
  };

  useEffect(() => {
    loadConnections();
  }, []);

  useEffect(() => {
    let cancelled = false;
    listDatabaseSources()
      .then((items) => !cancelled && setSources(items))
      .catch((err) => !cancelled && setError(err.message || "The database catalog could not be loaded."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  // The shape the marketplace grid expects.
  const toolkits = useMemo(() => sources.map((s) => ({ ...s, logo: s.toolkitLogo })), [sources]);
  const sourceBySlug = useMemo(() => Object.fromEntries(toolkits.map((t) => [t.slug, t])), [toolkits]);
  const connectedSlugs = useMemo(() => new Set(connections.map((c) => c.slug)), [connections]);
  const connectionState = (toolkit) => (connectedSlugs.has(toolkit.slug) ? "connected" : "idle");

  const closeModal = () => {
    setActive(null);
    setEditing(null);
  };

  const handleSaved = (message) => {
    closeModal();
    loadConnections();
    setNotice({ tone: "success", text: message });
  };

  const handleDelete = async (c) => {
    if (!(await confirm({ title: "Delete connection?", message: `"${c.name}" will be removed. This cannot be undone.`, confirmText: "Delete", tone: "danger" }))) return;
    setBusyId(c.id);
    try {
      await deleteDatabaseConnection(c.id);
      loadConnections();
      setNotice({ tone: "success", text: "Connection deleted." });
    } catch (err) {
      setNotice({ tone: "error", text: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const tabs = [
    ["marketplace", "Databases"],
    ["connections", `Connections${connectionsLoaded && connections.length ? ` (${connections.length})` : ""}`],
  ];

  return (
    <div className={`flex-1 min-w-0 flex flex-col h-full overflow-hidden ${styles.page}`}>
      <div className="w-full shrink-0 px-3 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 [@media(max-height:520px)]:pt-2">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 [@media(max-height:520px)]:mb-2">
          <div>
            <p className="text-xs font-medium tracking-widest text-(--accent-readable)">TOOL CATALOG · MCP_TOOLBOX</p>
            <h1 className="mt-1 text-2xl font-bold [@media(max-height:520px)]:text-lg">MCP Toolbox</h1>
            <p className={`mt-1 text-sm ${styles.body} [@media(max-height:520px)]:hidden`}>
              <span className="sm:hidden">Connect your databases.</span>
              <span className="hidden sm:inline">Connect your databases so your AI agents can work with your data.</span>
            </p>
          </div>
          <p className={`m-0 text-[12px] ${styles.muted}`}>
            {loading ? "Loading…" : `${toolkits.length} available · ${connectedSlugs.size} connected`}
          </p>
        </div>
        <div className={`-mb-px flex gap-5 overflow-x-auto border-b sm:gap-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${styles.divider}`} role="tablist">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={styles.tab(tab === id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="scrollable flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-3 pb-3 pt-3 sm:px-6 sm:pb-5 sm:pt-4 lg:px-8">
        {notice && (
          <div role="status" className={`mb-3 flex shrink-0 items-start justify-between gap-3 px-3.5 py-2.5 text-[13px] ${NOTICE_TONES[notice.tone]}`}>
            <span>{notice.text}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="cursor-pointer border-0 bg-transparent p-0 text-inherit">×</button>
          </div>
        )}

        {tab === "marketplace" && (
          <MarketplaceTab
            toolkits={toolkits}
            loading={loading}
            error={error}
            connectionState={connectionState}
            isLight={isLight}
            onOpen={(toolkit) => setActive(sourceBySlug[toolkit.slug] ?? toolkit)}
          />
        )}
        {tab === "connections" && (
          <div className="scrollable min-h-0 flex-1 overflow-y-auto">
            <ConnectionsTab
              connections={connections}
              sourceBySlug={sourceBySlug}
              loading={!connectionsLoaded}
              busyId={busyId}
              isLight={isLight}
              onEdit={(c) => {
                setEditing(c);
                setActive(sourceBySlug[c.slug] ?? null);
              }}
              onDelete={handleDelete}
              onBrowse={() => setTab("marketplace")}
            />
          </div>
        )}
      </div>

      {active && <SourceModal key={editing?.id ?? active.id} tool={active} connection={editing} isLight={isLight} onClose={closeModal} onSaved={handleSaved} />}
    </div>
  );
}
