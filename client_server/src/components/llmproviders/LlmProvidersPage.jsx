import { useEffect, useRef, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { getSession } from "../../services/authService";
import LlmConfigurationsPage from "./LlmConfigurationsPage";
import ProviderConfigModal from "./ProviderConfigModal";
import { listLlmProviders, removeProviderLogo, uploadProviderLogo } from "../../services/llmProviderService";

const MAX_LOGO_BYTES = 256 * 1024;

const humanize = (value) => (value ? value.replace(/_/g, " ") : value);

const STATUS_TONES = {
  active: "text-emerald-400 bg-emerald-400/10",
  beta: "text-amber-400 bg-amber-400/10",
  deprecated: "text-rose-400 bg-rose-400/10",
};

function Chip({ isLight, children, className }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${
        className || (isLight ? "bg-black/5 text-gray-600" : "bg-white/10 text-[#B4C0CE]")
      }`}
    >
      {children}
    </span>
  );
}

function Logo({ provider, isLight }) {
  const [failed, setFailed] = useState(false);
  const box = `flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md ${isLight ? "bg-black/5" : "bg-white/8"}`;
  if (provider.logo && !failed) {
    return (
      <span className={box}>
        <img src={provider.logo} alt={`${provider.name} logo`} onError={() => setFailed(true)} className="h-full w-full object-contain" />
      </span>
    );
  }
  return <span className={`${box} text-sm font-bold ${isLight ? "text-gray-500" : "text-[#AEBBCB]"}`}>{provider.name?.charAt(0).toUpperCase()}</span>;
}

function ProviderCard({ provider, isLight, isMaster, busy, onConfigure, onUploadLogo, onRemoveLogo }) {
  const fileInput = useRef(null);
  const linkBtn = "cursor-pointer border-0 bg-transparent p-0 font-medium text-(--accent-readable) hover:underline disabled:opacity-50";
  return (
    <article className={`flex flex-col gap-3 border p-4 ${isLight ? "bg-white border-black/8" : "bg-black border-white/10"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Logo key={provider.logo} provider={provider} isLight={isLight} />
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold" title={provider.name}>{provider.name}</h2>
            <p className={`text-[11px] uppercase tracking-wider ${isLight ? "text-gray-500" : "text-[#8B98A8]"}`}>
              {humanize(provider.category)} · v{provider.version}
            </p>
          </div>
        </div>
        <Chip isLight={isLight} className={STATUS_TONES[provider.status]}>{humanize(provider.status)}</Chip>
      </div>

      <p className={`text-[13px] leading-relaxed ${isLight ? "text-gray-600" : "text-[#AEBBCB]"}`}>
        {provider.description || "No description provided."}
      </p>

      <div className={`mt-auto flex items-center justify-between pt-2 text-[12px] ${isLight ? "text-gray-500" : "text-[#8B98A8]"}`}>
        <span>{provider.credentialRequired ? "Requires credentials" : "No credentials needed"}</span>
        <button type="button" onClick={onConfigure} className={linkBtn}>Configure</button>
        {provider.website && (
          <a href={provider.website} target="_blank" rel="noopener noreferrer" className="text-(--accent-readable) hover:underline">
            Website
          </a>
        )}
      </div>

      {isMaster && (
        <div className={`flex items-center gap-4 border-t pt-3 text-[12px] ${isLight ? "border-black/8" : "border-white/10"}`}>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) onUploadLogo(file);
            }}
          />
          <button type="button" disabled={busy} onClick={() => fileInput.current?.click()} className={linkBtn}>
            {busy ? "Working…" : provider.logo ? "Change logo" : "Upload logo"}
          </button>
          {provider.logo && <button type="button" disabled={busy} onClick={onRemoveLogo} className={`${linkBtn} text-rose-400!`}>Remove logo</button>}
        </div>
      )}
    </article>
  );
}

export default function LlmProvidersPage() {
  const { mainSectionTheme } = useTheme();
  const isLight = mainSectionTheme === "light";
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("providers"); // "providers": the catalog, "configurations": configure any provider
  const [configProviderId, setConfigProviderId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  // Only decides whether the controls show; the gateway rejects logo changes from any other role.
  const isMaster = getSession()?.user?.role === "MASTER";

  const changeLogo = async (provider, action) => {
    setError("");
    setBusyId(provider.id);
    try {
      const updated = await action();
      setProviders((current) => current.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      setError(err.message || "Failed to update the logo.");
    } finally {
      setBusyId(null);
    }
  };

  const uploadLogo = (provider, file) => {
    if (file.size > MAX_LOGO_BYTES) {
      setError("The logo must be 256 KB or smaller.");
      return;
    }
    return changeLogo(provider, () => uploadProviderLogo(provider.id, file));
  };

  useEffect(() => {
    let cancelled = false;
    listLlmProviders()
      .then((data) => !cancelled && setProviders(data || []))
      .catch((err) => !cancelled && setError(err.message || "Failed to load providers."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = providers.filter(
    (p) => !q || p.name?.toLowerCase().includes(q) || p.key?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q) || p.tags?.some((t) => t.toLowerCase().includes(q))
  );

  if (loading) {
    return (
      <div className={`flex-1 min-w-0 flex items-center justify-center h-full ${isLight ? "bg-white text-gray-500" : "bg-black text-[#566273]"}`}>
        Loading providers…
      </div>
    );
  }

  const header = (
    <div className="w-full shrink-0 px-3 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
      <div className="mb-4">
        <p className="text-xs font-medium tracking-widest text-(--accent-readable)">MODEL CATALOG</p>
        <h1 className="mt-1 text-2xl font-bold">LLM Providers</h1>
        <p className={`mt-1 text-sm ${isLight ? "text-gray-600" : "text-[#AEBBCB]"}`}>
          Providers available to your agents and workflows. Add a matching credential to start using one.
        </p>
      </div>
      <div className={`-mb-px flex gap-6 border-b ${isLight ? "border-black/8" : "border-white/10"}`} role="tablist">
        {[["providers", "Providers"], ["configurations", "Configurations"]].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`cursor-pointer border-0 border-b-2 bg-transparent px-0.5 pb-2.5 pt-1 text-sm transition-colors ${
              tab === id ? "border-(--accent-color) font-semibold text-(--accent-readable)" : `border-transparent ${isLight ? "text-gray-500" : "text-[#8B98A8]"} hover:text-inherit`
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className={`flex-1 min-w-0 flex flex-col h-full ${tab === "providers" ? "overflow-y-auto scrollable" : "overflow-hidden"} ${isLight ? "bg-white text-gray-900" : "bg-black text-white"}`}>
      {tab === "providers" && header}

      {tab === "configurations" ? (
        <LlmConfigurationsPage providers={providers} initialId={configProviderId} header={header} />
      ) : (
      <div className="w-full px-3 py-4 sm:px-6 sm:py-6 lg:px-8">

        {error && (
          <div role="alert" className="mb-6 px-3.5 py-2.5 text-[13px]" style={{ background: "rgba(251,113,133,0.1)", color: "#FB7185" }}>
            {error}
          </div>
        )}

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search providers"
          placeholder="Search by name, category, or tag…"
          className={`mb-4 w-full border px-3 py-2 text-sm outline-none ${
            isLight ? "bg-white border-black/10 text-gray-900 placeholder:text-gray-400" : "bg-black border-white/10 text-white placeholder:text-[#8B98A8]"
          }`}
        />

        {filtered.length === 0 ? (
          <div className={`py-16 text-center text-sm border border-dashed ${isLight ? "border-black/10 text-gray-500" : "border-white/10 text-[#8B98A8]"}`}>
            {providers.length === 0 ? "No providers are available yet." : "No providers match your search."}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((provider) => (
              <ProviderCard key={provider.id} provider={provider} isLight={isLight} isMaster={isMaster}
                busy={busyId === provider.id}
                onConfigure={() => setSelected(provider)}
                onUploadLogo={(file) => uploadLogo(provider, file)}
                onRemoveLogo={() => changeLogo(provider, () => removeProviderLogo(provider.id))}
              />
            ))}
          </div>
        )}
      </div>
      )}
      {selected && (
        <ProviderConfigModal
          provider={selected}
          isLight={isLight}
          onClose={() => setSelected(null)}
          onOpenConfigurations={(p) => {
            setSelected(null);
            setConfigProviderId(p.id);
            setTab("configurations");
          }}
        />
      )}
    </div>
  );
}
