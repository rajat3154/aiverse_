import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useConfirm } from "../../hooks/useConfirm";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import ProviderConfigModal from "./ProviderConfigModal";

// The Configurations tab of the LLM Providers page: every LLM provider as square cards in the left half; the selected provider's configurations and full form in the right half.
function ProviderTile({ provider, active, isLight, onSelect }) {
  const [failed, setFailed] = useState(false);
  const muted = isLight ? "text-gray-500" : "text-[#8B98A8]";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={`relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-2 border p-3 text-center transition-colors ${
        active
          ? "border-(--accent-color) " + (isLight ? "bg-black/5" : "bg-white/8")
          : `${isLight ? "border-black/10 bg-white hover:bg-black/3" : "border-white/10 bg-black hover:bg-white/4"}`
      }`}
    >
      {active && <span className="absolute inset-x-0 bottom-0 h-0.5" style={{ backgroundImage: "var(--accent-paint)" }} aria-hidden="true" />}
      {provider.logo && !failed ? (
        <img src={provider.logo} alt="" onError={() => setFailed(true)} className="h-10 w-10 shrink-0 object-contain" />
      ) : (
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center text-base font-bold ${isLight ? "bg-black/5" : "bg-white/8"} ${muted}`}>{provider.name?.charAt(0).toUpperCase()}</span>
      )}
      <span className="w-full min-w-0">
        <span className="block truncate text-[14px] font-semibold">{provider.name}</span>
        <span className={`block truncate text-[11.5px] capitalize ${muted}`}>{(provider.category || "").replace(/_/g, " ")}</span>
      </span>
    </button>
  );
}

export default function LlmConfigurationsPage({ providers, initialId, header }) {
  const { mainSectionTheme } = useTheme();
  const isLight = mainSectionTheme === "light";
  const [selectedId, setSelectedId] = useState(initialId ?? null);
  const [search, setSearch] = useState("");
  // Below md there is room for one half at a time: the provider cards, or the selected provider's panel with a back button.
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [showPanel, setShowPanel] = useState(initialId != null);

  const selected = providers.find((p) => String(p.id) === String(selectedId)) ?? providers[0] ?? null;
  const q = search.trim().toLowerCase();
  const filtered = providers.filter((p) => !q || p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q));

  const confirm = useConfirm();
  const select = async (provider) => {
    if (!isDesktop && !showPanel) {
      setSelectedId(provider.id);
      setShowPanel(true);
      return;
    }
    if (selected && provider.id === selected.id) return;
    if (!(await confirm({ title: "Switch provider?", message: "Any unsaved changes will be lost.", confirmText: "Switch" }))) return;
    setSelectedId(provider.id);
  };

  const backToProviders = async () => {
    if (!(await confirm({ title: "Leave this provider?", message: "Any unsaved changes will be lost.", confirmText: "Leave" }))) return;
    setShowPanel(false);
  };

  const page = isLight ? "bg-white text-gray-900" : "bg-black text-white";
  const line = isLight ? "border-[#E5E4E7]" : "border-[#263241]/60";
  const muted = isLight ? "text-gray-500" : "text-[#8B98A8]";

  if (providers.length === 0) {
    return <div className={`flex min-h-64 flex-1 items-center justify-center text-sm ${muted}`}>No providers are available yet.</div>;
  }

  return (
    <div className={`flex min-h-0 min-w-0 flex-1 flex-col md:flex-row ${page}`}>
      {(isDesktop || !showPanel) && (
      <nav aria-label="LLM providers" className={`flex min-h-0 w-full flex-1 flex-col md:w-1/2 md:flex-none md:border-r ${line}`}>
        <div className="shrink-0">{header}</div>
        <div className={`shrink-0 border-b px-4 py-4 ${line}`}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search providers"
            placeholder="Search providers…"
            className={`w-full border px-3 py-2 text-[13.5px] outline-none focus:border-(--accent-color) ${
              isLight ? "border-black/10 bg-white placeholder:text-gray-400" : "border-white/10 bg-black placeholder:text-[#566273]"
            }`}
          />
        </div>
        <div className="scrollable min-h-0 flex-1 overflow-y-auto p-4">
          {filtered.length === 0 ? (
            <p className={`m-0 py-6 text-center text-[13px] ${muted}`}>No providers match your search.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {filtered.map((p) => <ProviderTile key={p.id} provider={p} active={selected?.id === p.id} isLight={isLight} onSelect={() => select(p)} />)}
            </div>
          )}
        </div>
      </nav>
      )}

      {(isDesktop || showPanel) && (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:w-1/2 md:flex-none">
        {!isDesktop && (
          <button
            type="button"
            onClick={backToProviders}
            className={`flex shrink-0 cursor-pointer items-center gap-1.5 border-0 border-b bg-transparent px-4 py-3 text-left text-[13.5px] font-medium text-(--accent-readable) ${line}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            All providers
          </button>
        )}
        <div className="flex min-h-0 min-w-0 flex-1">
          {selected && <ProviderConfigModal key={selected.id} provider={selected} asPage onClose={() => {}} />}
        </div>
      </div>
      )}
    </div>
  );
}
