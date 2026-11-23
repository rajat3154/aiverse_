import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useConfirm } from "../../hooks/useConfirm";
import { useIntegrationConnections } from "../../hooks/useIntegrationConnections";
import { getSession } from "../../services/authService";
import { listToolkits } from "../../services/integrationService";
import McpToolboxCatalog from "../databasetoolbox/McpToolboxCatalog";
import AdminBar from "./AdminBar";
import MarketplaceTab from "./MarketplaceTab";
import MyConnectionsTab from "./MyConnectionsTab";
import { getStyles } from "./styles";
import ToolkitPanel from "./ToolkitPanel";

const NOTICE_TONES = {
  success: "bg-emerald-400/10 text-emerald-400",
  error: "bg-rose-400/10 text-rose-400",
  info: "bg-(--accent-soft) text-(--accent-readable)",
};

function ToolkitIntegrations() {
  const { mainSectionTheme } = useTheme();
  // Only decides whether the admin strip shows; the gateway rejects the sync endpoint for any other role.
  const isMaster = getSession()?.user?.role === "MASTER";
  const confirm = useConfirm();
  const isLight = mainSectionTheme === "light";
  const styles = getStyles(isLight);
  const { connections, loaded, error: connectionError, busy, notice, setNotice, connect, disconnect } = useIntegrationConnections(confirm);

  const [toolkits, setToolkits] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [tab, setTab] = useState("marketplace");
  const [panelToolkit, setPanelToolkit] = useState(null);
  // /integrations?provider=composio (the sidebar's provider entry) narrows the marketplace to one provider.
  const providerFilter = useMemo(() => new URLSearchParams(window.location.search).get("provider"), []);

  const loadCatalog = useCallback(() => {
    let cancelled = false;
    listToolkits({ provider: providerFilter || undefined })
      .then((items) => {
        if (cancelled) return;
        setToolkits(items);
        setCatalogError("");
      })
      .catch((e) => !cancelled && setCatalogError(e.message || "The integration catalog could not be loaded."))
      .finally(() => !cancelled && setCatalogLoading(false));
    return () => {
      cancelled = true;
    };
  }, [providerFilter]);

  useEffect(() => loadCatalog(), [loadCatalog]);

  const toolkitBySlug = useMemo(() => Object.fromEntries(toolkits.map((t) => [t.slug, t])), [toolkits]);
  const activeSlugs = useMemo(() => new Set(connections.filter((c) => c.status === "ACTIVE").map((c) => c.toolkit?.slug)), [connections]);
  const connectionState = useCallback((toolkit) => (activeSlugs.has(toolkit.slug) ? "connected" : toolkit.no_auth ? "open" : "idle"), [activeSlugs]);
  const connectedCount = toolkits.filter((t) => activeSlugs.has(t.slug)).length;

  const tabs = [
    ["marketplace", "Marketplace"],
    ["connections", `Connections${loaded && connections.length ? ` (${connections.length})` : ""}`],
  ];

  return (
    <div className={`flex-1 min-w-0 flex flex-col h-full overflow-hidden ${styles.page}`}>
      <div className="w-full shrink-0 px-3 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 [@media(max-height:520px)]:pt-2">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 [@media(max-height:520px)]:mb-2">
          <div>
            <p className="text-xs font-medium tracking-widest text-(--accent-readable)">
              {providerFilter ? `TOOL CATALOG · ${providerFilter.toUpperCase()}` : "TOOL CATALOG"}
            </p>
            <h1 className="mt-1 text-2xl font-bold [@media(max-height:520px)]:text-lg">Integrations</h1>
            <p className={`mt-1 text-sm ${styles.body} [@media(max-height:520px)]:hidden`}>
              <span className="sm:hidden">Connect apps and extend your AI agents.</span>
              <span className="hidden sm:inline">Connect your favourite apps and extend what your AI agents can do.</span>
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <p className={`m-0 text-[12px] ${styles.muted}`}>
              {catalogLoading ? "Loading…" : `${toolkits.length} available · ${connectedCount} connected`}
            </p>
            {isMaster && <AdminBar isLight={isLight} onNotice={setNotice} onSynced={loadCatalog} />}
          </div>
        </div>
        <div className={`-mb-px flex gap-5 overflow-x-auto border-b sm:gap-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${styles.divider}`} role="tablist">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={styles.tab(tab === id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* The area takes the remaining height. It only shows a scrollbar on a screen too short for four rows of apps. */}
      <div className="scrollable flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-3 pb-3 pt-3 sm:px-6 sm:pb-5 sm:pt-4 lg:px-8">
        {notice && (
          <div role="status" className={`mb-3 flex shrink-0 items-start justify-between gap-3 px-3.5 py-2.5 text-[13px] ${NOTICE_TONES[notice.tone]}`}>
            <span>{notice.text}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setNotice(null)} className="cursor-pointer border-0 bg-transparent p-0 text-inherit">×</button>
          </div>
        )}
        {connectionError && <div role="alert" className={`mb-3 shrink-0 ${styles.error}`}>{connectionError}</div>}

        {tab === "marketplace" && (
          <MarketplaceTab
            toolkits={toolkits}
            loading={catalogLoading}
            error={catalogError}
            connectionState={connectionState}
            isLight={isLight}
            onOpen={setPanelToolkit}
          />
        )}
        {tab === "connections" && (
          <div className="scrollable min-h-0 flex-1 overflow-y-auto">
            <MyConnectionsTab
              connections={connections}
              toolkitBySlug={toolkitBySlug}
              loading={!loaded}
              busy={busy}
              isLight={isLight}
              onManage={setPanelToolkit}
              onDisconnect={disconnect}
              onBrowse={() => setTab("marketplace")}
            />
          </div>
        )}
      </div>

      {panelToolkit && (
        <ToolkitPanel
          key={panelToolkit.slug}
          toolkit={toolkitBySlug[panelToolkit.slug] ?? panelToolkit}
          connections={connections}
          busy={busy}
          isLight={isLight}
          onClose={() => setPanelToolkit(null)}
          onConnect={connect}
          onDisconnect={disconnect}
        />
      )}
    </div>
  );
}

// The MCP Toolbox provider is a list of databases to connect to rather than apps to authorize, so it has its own page.
export default function IntegrationsPage() {
  const provider = new URLSearchParams(window.location.search).get("provider");
  return provider === "mcp_toolbox" ? <McpToolboxCatalog /> : <ToolkitIntegrations />;
}
