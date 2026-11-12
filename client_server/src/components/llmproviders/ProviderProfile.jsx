// Read-only overview of a provider, built from its manifest: description, tags, capabilities, models, credentials
// and links. A new provider needs no changes here.

const cap = (s) => {
  const text = String(s).replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};
const alpha = (a, b) => a.localeCompare(b);

const LINKS = [
  ["documentation.official", "Docs"],
  ["documentation.api_reference", "API reference"],
  ["documentation.models", "Models"],
  ["documentation.pricing", "Pricing"],
  ["metadata.pricing_url", "Pricing"],
  ["metadata.support_url", "Support"],
  ["metadata.release_notes_url", "Release notes"],
];
const pick = (obj, path) => path.split(".").reduce((o, k) => o?.[k], obj);

const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);
const CrossIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
);
const ArrowIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17L17 7M8 7h9v9" /></svg>
);

const tones = (isLight) => ({
  muted: isLight ? "text-gray-500" : "text-white",
  soft: isLight ? "text-gray-600" : "text-white",
  line: isLight ? "border-black/10" : "border-white/12",
  surface: isLight ? "border border-[#E5E4E7] bg-white" : "bg-white/5",
  divide: isLight ? "divide-black/8" : "divide-white/10",
});

function Card({ title, count, children, isLight }) {
  const t = tones(isLight);
  return (
    <section className={`overflow-hidden ${t.surface}`}>
      <div className="flex items-center justify-between px-4 pt-3.5">
        <h4 className="text-[13px] font-semibold">{title}</h4>
        {count !== undefined && <span className={`text-[11px] tabular-nums ${t.muted}`}>{count}</span>}
      </div>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

// Compact list: one row per model (name + id); a row opens to show its capabilities and modalities.
function ModelList({ models, isLight }) {
  const t = tones(isLight);
  return (
    <Card title="Models" count={models.length} isLight={isLight}>
      <ul className={`scrollable -my-3 -mx-4 m-0 max-h-80 list-none divide-y overflow-y-auto p-0 ${t.divide}`}>
        {models.map((model) => {
          const caps = Object.entries(model.capabilities || {}).filter(([, v]) => v).map(([k]) => cap(k));
          const input = (model.input_modalities || []).join(", ");
          const output = (model.output_modalities || []).join(", ");
          const hasDetail = caps.length > 0 || input || output;
          return (
            <li key={model.id}>
              <details className="group">
                <summary className={`flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 [&::-webkit-details-marker]:hidden ${isLight ? "hover:bg-black/4" : "hover:bg-white/5"}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium" title={model.name || model.id}>{model.name || model.id}</span>
                    {model.name && <span className={`block truncate text-[11px] ${t.muted}`} title={model.id}>{model.id}</span>}
                  </span>
                  {hasDetail && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 transition-transform group-open:rotate-180 ${t.muted}`}><polyline points="6 9 12 15 18 9" /></svg>
                  )}
                </summary>
                {hasDetail && (
                  <div className="flex flex-col gap-2 px-4 pb-3">
                    {caps.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {caps.map((c) => (
                          <span key={c} className={`px-2 py-0.5 text-[10.5px] ${isLight ? "border border-[#E5E4E7] bg-white text-gray-700" : "bg-white/10 text-white"}`}>{c}</span>
                        ))}
                      </div>
                    )}
                    {(input || output) && (
                      <p className={`m-0 text-[11.5px] ${t.muted}`}>
                        <span className="capitalize">{input || "—"}</span> <span aria-hidden="true">→</span> <span className="capitalize">{output || "—"}</span>
                      </p>
                    )}
                  </div>
                )}
              </details>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function ProviderOverview({ provider, isLight }) {
  const t = tones(isLight);
  const m = provider.manifest || {};

  const capabilities = Object.entries(m.capabilities || {});
  const supported = capabilities.filter(([, v]) => v).map(([k]) => k).sort(alpha);
  const unsupported = capabilities.filter(([, v]) => !v).map(([k]) => k).sort(alpha);
  const models = [...(m.model_discovery?.fallback?.models || [])].sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
  const tags = [...(provider.tags || [])].sort(alpha);

  const seen = new Set();
  const links = LINKS.map(([path, label]) => [label, pick(m, path)]).filter(([, href]) => {
    if (typeof href !== "string" || seen.has(href)) return false;
    seen.add(href);
    return true;
  });

  return (
    <div className="grid gap-4">
      {/* quick facts */}
      <div className="grid grid-cols-2 gap-3">
        {[
          ["Models", models.length || "—"],
          ["Capabilities", capabilities.length ? supported.length : "—"],
        ].map(([label, value]) => (
          <div key={label} className={` px-3.5 py-3 ${t.surface}`}>
            <div className="text-lg font-semibold leading-tight">{value}</div>
            <div className={`mt-0.5 text-[11.5px] ${t.muted}`}>{label}</div>
          </div>
        ))}
      </div>

      {(provider.description || tags.length > 0) && (
        <div>
          {provider.description && <p className={`text-[14px] leading-relaxed ${t.soft}`}>{provider.description}</p>}
          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span key={tag} className={` px-2.5 py-0.5 text-[11px] ${t.surface} ${t.soft}`}>{tag}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {capabilities.length > 0 && (
        <Card title="Capabilities" count={`${supported.length} of ${capabilities.length}`} isLight={isLight}>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
            {supported.map((k) => (
              <li key={k} className="flex items-center gap-2">
                <span className="text-emerald-500"><CheckIcon /></span>
                {cap(k)}
              </li>
            ))}
            {unsupported.map((k) => (
              <li key={k} className={`flex items-center gap-2 opacity-60 ${t.muted}`}>
                <CrossIcon />
                {cap(k)}
              </li>
            ))}
          </ul>
        </Card>
      )}


      {models.length > 0 && <ModelList models={models} isLight={isLight} />}

      {links.length > 0 && (
        <Card title="Resources" isLight={isLight}>
          <div className="flex flex-wrap gap-2">
            {links.map(([label, href]) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[12px] transition ${t.surface} ${isLight ? "text-gray-700 hover:bg-black/4" : "text-white hover:bg-white/8"}`}
              >
                {label}
                <ArrowIcon />
              </a>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
