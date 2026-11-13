import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useConfirm } from "../../hooks/useConfirm";
import { listCredentials } from "../../services/credentialService";
import {
  activateProviderConfiguration,
  createProviderConfiguration,
  deleteProviderConfiguration,
  listProviderConfigurations,
  listProviderModels,
  updateProviderConfiguration,
} from "../../services/llmProviderService";
import Dropdown from "./Dropdown";
import JsonField from "./JsonField";
import ProviderChat from "./ProviderChat";
import { ProviderOverview } from "./ProviderProfile";

// The provider drawer. The settings are drawn from the provider manifest (groups + fields), so a new provider needs no
// frontend change. A user keeps several saved configurations per provider (credential, model, settings, parameters), with
// at most one active, and can chat with the selected one on the Test tab.
//
// The Configuration tab is a compact node-style panel: one narrow column, a bold label with an info tooltip above each
// full-width control, number fields with +/- steppers, and toggles on the same row as their label.

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
const normalizeOptions = (options = []) =>
  options.map((o) => (typeof o === "object" ? { value: o.value, label: o.label ?? String(o.value) } : { value: o, label: String(o) }));

function matches(condition, values) {
  if (!condition) return true;
  return Object.entries(condition).every(([key, expected]) => (Array.isArray(expected) ? expected.includes(values[key]) : values[key] === expected));
}

// A base URL with no declared default starts out as the provider's standard endpoint (its placeholder), so it is never blank.
const defaultValue = (f) => f.default ?? (f.type === "boolean" ? false : f.key === "base_url" ? f.placeholder ?? "" : "");
const initialValues = (fields) => Object.fromEntries(fields.map((f) => [f.key, defaultValue(f)]));
const isModified = (f, value) => (value ?? "") !== defaultValue(f);
// Saved values -> form values (JSON fields are edited as text), and form values -> only what differs from the defaults.
const toFormValues = (fields, saved) =>
  Object.fromEntries(
    fields.map((f) => {
      const v = saved?.[f.key];
      if (v === undefined || v === null) return [f.key, defaultValue(f)];
      if (f.input === "json" && typeof v !== "string") return [f.key, JSON.stringify(v, null, 2)];
      return [f.key, v];
    })
  );
function encodeFields(fields, values) {
  const out = {};
  fields.forEach((f) => {
    if (f.supported === false || !matches(f.visible_when, values)) return;
    const v = values[f.key];
    if (!isModified(f, v) || v === "" || v == null) return;
    if (f.input === "json") {
      try {
        out[f.key] = JSON.parse(v);
      } catch {
        throw new Error(`${f.label} is not valid JSON.`);
      }
    } else {
      out[f.key] = v;
    }
  });
  return out;
}
// "label: value" pairs for the settings a saved configuration changed from the defaults, so a card says what the configuration is.
function summarize(fields, saved) {
  return fields
    .filter((f) => f.supported !== false && saved?.[f.key] !== undefined && saved[f.key] !== null && saved[f.key] !== "")
    .map((f) => {
      const v = saved[f.key];
      const value = typeof v === "boolean" ? (v ? "On" : "Off") : Array.isArray(v) ? `${v.length} item${v.length === 1 ? "" : "s"}` : typeof v === "object" ? `${Object.keys(v).length} set` : String(v);
      return { key: f.key, label: f.label || f.key, value: value.length > 32 ? `${value.slice(0, 31)}…` : value };
    });
}
const makeSnapshot = (name, credentialId, model, configValues, paramValues) => JSON.stringify([name, credentialId, model, configValues, paramValues]);
const inputClass = (isLight) =>
  `w-full border px-4 py-3 text-[14px] outline-none transition-colors focus:border-(--accent-color) disabled:opacity-50 ${
    isLight ? "bg-white border-[#E5E4E7] text-gray-900 placeholder:text-gray-400" : "bg-black border-[#263241] text-white placeholder:text-[#566273]"
  }`;

const matchesQuery = (f, q) => !q || [f.label, f.key, f.help_text, f.description].some((t) => t && String(t).toLowerCase().includes(q));

// A JSON field must hold valid JSON of the type the manifest declares (array / object). Empty is allowed.
function jsonProblem(field, value) {
  if (value === "" || value == null) return null;
  try {
    const parsed = JSON.parse(value);
    if (field.type === "array" && !Array.isArray(parsed)) return "Enter a JSON array, for example [\"a\", \"b\"].";
    if (field.type === "object" && (parsed === null || typeof parsed !== "object" || Array.isArray(parsed))) return "Enter a JSON object, for example {\"key\": \"value\"}.";
    return null;
  } catch {
    return "Not valid JSON.";
  }
}

// "Range 0 – 2", "Minimum 1": the allowed range of a numeric field.
function rangeHint(field) {
  if (field.input !== "number" && field.input !== "slider") return null;
  const { minimum: min, maximum: max } = field;
  if (min !== undefined && max !== undefined) return `Range ${min} – ${max}`;
  if (min !== undefined) return `Minimum ${min}`;
  if (max !== undefined) return `Maximum ${max}`;
  return null;
}

const svg = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" };
const CloseIcon = () => (<svg width="18" height="18" viewBox="0 0 24 24" strokeWidth="2" {...svg}><path d="M18 6L6 18M6 6l12 12" /></svg>);
const ChevronDown = ({ className = "" }) => (<svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="2.2" className={className} {...svg}><polyline points="6 9 12 15 18 9" /></svg>);
const ChevronUp = () => (<svg width="10" height="10" viewBox="0 0 24 24" strokeWidth="2.6" {...svg}><polyline points="6 15 12 9 18 15" /></svg>);
const SearchIcon = () => (<svg width="15" height="15" viewBox="0 0 24 24" strokeWidth="1.9" {...svg}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>);
const ExternalIcon = () => (<svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="1.8" {...svg}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" /></svg>);
const InfoIcon = () => (<svg width="13" height="13" viewBox="0 0 24 24" strokeWidth="1.8" {...svg}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>);

function Switch({ id, checked, disabled, onChange }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full border-0 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "" : "bg-gray-400/40"}`}
      style={checked ? { backgroundImage: "var(--accent-paint)" } : undefined}
    >
      <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}

function Control({ field, value, onChange, isLight }) {
  const base = `w-full border px-4 py-3 text-[14px] outline-none transition-colors focus:border-(--accent-color) disabled:opacity-50 ${
    isLight ? "bg-white border-[#E5E4E7] text-gray-900 placeholder:text-gray-400" : "bg-black border-[#263241] text-white placeholder:text-[#566273]"
  }`;
  const id = `field-${field.key}`;
  const disabled = Boolean(field.disabled);
  const input = field.input;

  if (input === "select" || input === "radio") {
    const opts = normalizeOptions(field.options);
    const all = field.required ? opts : [{ value: "", label: "Default" }, ...opts];
    return <Dropdown id={id} value={value ?? ""} options={all} onChange={onChange} disabled={disabled} searchable={all.length > 8} placeholder="Select…" isLight={isLight} base={base} />;
  }
  // lists and named values: friendly editors instead of raw JSON (the JSON editor is one click away)
  if (input === "json" && (field.type === "array" || field.type === "object")) {
    return <JsonField id={id} field={field} value={value} onChange={onChange} isLight={isLight} base={base} problem={jsonProblem(field, value)} />;
  }
  if (input === "textarea" || input === "json" || input === "code") {
    const jsonError = input === "json" ? jsonProblem(field, value) : null;
    const example = field.type === "array" ? '["value1", "value2"]' : field.type === "object" ? '{"key": "value"}' : "";
    return (
      <>
        <textarea
          id={id}
          rows={3}
          value={value ?? ""}
          placeholder={field.placeholder ?? example}
          disabled={disabled}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          className={`${base} resize-y text-[13px] ${jsonError ? "border-rose-400!" : ""}`}
        />
        {jsonError && <p className="mt-1.5 text-[12px] text-rose-500">{jsonError}</p>}
      </>
    );
  }
  if (input === "number" || input === "slider") {
    const step = Number(field.step) || 1;
    const clamp = (n) => Math.min(field.maximum ?? Infinity, Math.max(field.minimum ?? -Infinity, n));
    const bump = (dir) => {
      const current = value === "" || value == null ? null : Number(value);
      onChange(current === null || Number.isNaN(current) ? clamp(field.default ?? field.minimum ?? 0) : clamp(Number((current + dir * step).toFixed(6))));
    };
    const stepBtn = `flex h-1/2 w-6 cursor-pointer items-center justify-center border-0 bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-30 ${isLight ? "text-gray-500 hover:text-gray-900" : "text-[#8B98A8] hover:text-white"}`;
    return (
      <div className="relative">
        <input
          id={id}
          type="number"
          value={value ?? ""}
          min={field.minimum}
          max={field.maximum}
          step={field.step}
          placeholder={field.placeholder ?? (field.default != null ? String(field.default) : "Type a number")}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className={`${base} pr-10 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
        />
        <div className="absolute inset-y-1 right-1.5 flex flex-col">
          <button type="button" aria-label="Increase" tabIndex={-1} disabled={disabled} onClick={() => bump(1)} className={stepBtn}><ChevronUp /></button>
          <button type="button" aria-label="Decrease" tabIndex={-1} disabled={disabled} onClick={() => bump(-1)} className={`${stepBtn} rotate-180`}><ChevronUp /></button>
        </div>
      </div>
    );
  }
  return (
    <input
      id={id}
      type={input === "password" ? "password" : input === "url" ? "url" : "text"}
      value={value ?? ""}
      placeholder={field.placeholder ?? "Type something..."}
      disabled={disabled}
      autoComplete="off"
      onChange={(e) => onChange(e.target.value)}
      className={base}
    />
  );
}

// One group per manifest group, in order, tagged with the section (configuration / parameters) it belongs to.
function buildGroups(provider) {
  const sections = [
    { label: "Configuration", key: "configuration", definition: provider.configuration },
    { label: "Parameters", key: "parameters", definition: provider.parameters },
  ];
  const groups = [];
  sections.forEach(({ label, key, definition }) => {
    const fields = (definition?.fields || []).filter((f) => f.supported !== false);
    const defined = [...(definition?.groups || [])].sort(byOrder);
    defined.forEach((g) => {
      const groupFields = fields.filter((f) => f.group === g.key).sort(byOrder);
      if (groupFields.length) groups.push({ id: `${key}-${g.key}`, source: key, sectionLabel: label, key: g.key, label: g.label, description: g.description, fields: groupFields });
    });
    const rest = fields.filter((f) => !defined.some((g) => g.key === f.group)).sort(byOrder);
    if (rest.length) groups.push({ id: `${key}-_other`, source: key, sectionLabel: label, key: "_other", label: "Other", fields: rest });
  });
  return groups;
}

function FieldRow({ field, value, onChange, onReset, isLight }) {
  const modified = isModified(field, value);
  const toggle = field.input === "switch" || field.input === "checkbox";
  const tip = [field.help_text || field.description, rangeHint(field)].filter(Boolean).join(" · ");
  const muted = isLight ? "text-gray-500" : "text-[#8B98A8]";

  const label = (
    <span className="flex min-w-0 items-center gap-1.5">
      <label htmlFor={`field-${field.key}`} className="cursor-pointer text-[13.5px] font-semibold leading-tight">
        {field.label}
        {field.required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      {tip && <span title={tip} aria-label={tip} className={`inline-flex cursor-help ${muted}`}><InfoIcon /></span>}
      {modified && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-(--accent-color)" title="Changed from the default" />}
    </span>
  );
  const reset = modified && (
    <button type="button" onClick={onReset} className="cursor-pointer border-0 bg-transparent p-0 text-[12px] font-medium text-(--accent-readable) hover:underline">Reset</button>
  );

  if (toggle) {
    return (
      <div className="flex items-center justify-between gap-3">
        {label}
        <span className="flex shrink-0 items-center gap-3">
          {reset}
          <Switch id={`field-${field.key}`} checked={Boolean(value)} disabled={field.disabled} onChange={onChange} />
        </span>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        {label}
        {reset}
      </div>
      <Control field={field} value={value} onChange={onChange} isLight={isLight} />
    </div>
  );
}

function GroupBlock({ group, query, values, setValues, isLight, showHeading }) {
  const muted = isLight ? "text-gray-500" : "text-[#8B98A8]";
  const [showAdvanced, setShowAdvanced] = useState(false);
  const visible = group.fields.filter((f) => matches(f.visible_when, values) && matchesQuery(f, query));
  if (visible.length === 0) return null;

  const regular = visible.filter((f) => !f.advanced);
  const advanced = visible.filter((f) => f.advanced);
  const advancedActive = advanced.some((f) => isModified(f, values[f.key]));
  const advancedOpen = showAdvanced || advancedActive || Boolean(query) || regular.length === 0;

  const renderField = (field) => (
    <FieldRow
      key={field.key}
      field={field}
      value={values[field.key]}
      onChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))}
      onReset={() => setValues((prev) => ({ ...prev, [field.key]: defaultValue(field) }))}
      isLight={isLight}
    />
  );

  return (
    <section className="flex flex-col gap-5">
      {showHeading && (
        <h3 className={`m-0 border-t pt-5 text-[13px] font-semibold first:border-t-0 first:pt-0 ${muted} ${isLight ? "border-[#E5E4E7]" : "border-[#263241]/60"}`}>{group.label}</h3>
      )}
      {regular.map(renderField)}
      {advanced.length > 0 && (
        <>
          {regular.length > 0 && (
            <button
              type="button"
              aria-expanded={advancedOpen}
              disabled={advancedActive || Boolean(query)}
              onClick={() => setShowAdvanced((v) => !v)}
              className={`flex w-fit cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-[12.5px] font-medium disabled:cursor-default ${muted} hover:text-inherit`}
            >
              <ChevronDown className={`transition-transform ${advancedOpen ? "" : "-rotate-90"}`} />
              Advanced ({advanced.length})
            </button>
          )}
          {advancedOpen && advanced.map(renderField)}
        </>
      )}
    </section>
  );
}

const norm = (t) => String(t ?? "").replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").toUpperCase();

// The user's own credentials that belong to this provider: by identifier (OPENAI_API_KEY) or by the provider name.
function matchingCredentials(credentials, provider) {
  const ids = [norm(provider.slug), norm(provider.name)].filter(Boolean);
  return credentials.filter((c) => ids.some((id) => norm(c.identifier).startsWith(`${id}_`) || norm(c.provider) === id));
}

// API key (picked from the credentials the user already saved) and model (picked from the provider's models, or typed).
function ConnectionBlock({ provider, models, needsKey, credentialId, setCredentialId, model, setModel, showKey, showModel, isLight }) {
  const [state, setState] = useState({ status: needsKey ? "loading" : "idle", credentials: [] });
  useEffect(() => {
    if (!needsKey) return undefined;
    let cancelled = false;
    listCredentials()
      .then((data) => !cancelled && setState({ status: "ready", credentials: Array.isArray(data) ? data : data?.content ?? [] }))
      .catch(() => !cancelled && setState({ status: "error", credentials: [] }));
    return () => {
      cancelled = true;
    };
  }, [needsKey]);

  // once a credential is chosen, ask the provider for the models that key can use; until then (or on failure) the manifest list is shown
  // only providers whose manifest describes a models endpoint can be asked; the rest (e.g. LiteLLM) just use the default list
  const canList = Boolean(provider.manifest?.model_discovery?.remote?.path);
  const [live, setLive] = useState({ key: "", status: "idle", models: [], error: "" });
  useEffect(() => {
    if (!credentialId || !canList) return undefined;
    let cancelled = false;
    listProviderModels(provider.id, credentialId)
      .then((data) => !cancelled && setLive({ key: credentialId, status: "ready", models: Array.isArray(data) ? data : [], error: "" }))
      .catch((err) => !cancelled && setLive({ key: credentialId, status: "error", models: [], error: err.message || "Could not load models." }));
    return () => {
      cancelled = true;
    };
  }, [credentialId, canList, provider.id]);
  const liveState = !canList || !credentialId ? "idle" : live.key === credentialId ? live.status : "loading";
  const modelList = liveState === "ready" && live.models.length > 0 ? live.models : models;

  const muted = isLight ? "text-gray-500" : "text-[#8B98A8]";
  const matched = matchingCredentials(state.credentials, provider);
  const others = state.credentials.filter((c) => !matched.includes(c));
  const options = [...matched, ...others];
  const optionLabel = (c) => `${c.name}${c.status && c.status !== "ACTIVE" ? ` (${c.status.toLowerCase()})` : ""}`;
  const base = `w-full border px-4 py-3 text-[14px] outline-none transition-colors focus:border-(--accent-color) ${
    isLight ? "bg-white border-[#E5E4E7] text-gray-900 placeholder:text-gray-400" : "bg-black border-[#263241] text-white placeholder:text-[#566273]"
  }`;
  const labelOf = (text, htmlFor, tip, required) => (
    <span className="flex items-center gap-1.5">
      <label htmlFor={htmlFor} className="cursor-pointer text-[13.5px] font-semibold leading-tight">
        {text}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </label>
      <span title={tip} aria-label={tip} className={`inline-flex cursor-help ${muted}`}><InfoIcon /></span>
    </span>
  );

  return (
    <section className="flex flex-col gap-5">
      {showKey && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            {labelOf(`${provider.name} API Key`, "field-credential", "Choose one of the credentials you saved for this provider.", true)}
            <a href="/credentials" className="text-[12px] font-medium text-(--accent-readable) hover:underline">{options.length ? "Manage" : "Add credential"}</a>
          </div>
          <Dropdown
            id="field-credential"
            value={credentialId}
            onChange={setCredentialId}
            disabled={state.status !== "ready" || options.length === 0}
            options={[
              ...matched.map((c) => ({ value: c.id, label: optionLabel(c), hint: c.identifier || c.provider || undefined, group: others.length ? `${provider.name} credentials` : undefined })),
              ...others.map((c) => ({ value: c.id, label: optionLabel(c), hint: c.identifier || c.provider || undefined, group: matched.length ? "Other credentials" : undefined })),
            ]}
            placeholder={
              state.status === "loading" ? "Loading credentials…" : state.status === "error" ? "Could not load credentials" : options.length === 0 ? "No credentials saved yet" : "Select a credential"
            }
            searchable={options.length > 8}
            isLight={isLight}
            base={base}
          />
          {state.status === "ready" && options.length === 0 && (
            <p className={`m-0 mt-1.5 text-[12px] ${muted}`}>Save a credential under Credentials and it will show up here.</p>
          )}
        </div>
      )}

      {showModel && (
        <div>
          <div className="mb-2">{labelOf("Model", "field-model", "Pick one of the provider's models, or type a model id.")}</div>
          <Dropdown
            id="field-model"
            value={model}
            onChange={setModel}
            allowCustom
            options={modelList.map((m) => ({ value: m.id, label: m.name || m.id, hint: m.name && m.name !== m.id ? m.id : undefined }))}
            placeholder={liveState === "loading" ? "Loading models…" : modelList.length ? "Select or type a model" : "Type a model id"}
            isLight={isLight}
            base={base}
          />
          {liveState === "loading" && <p className={`m-0 mt-1.5 text-[12px] ${muted}`}>Fetching models for this key…</p>}
          {liveState === "ready" && live.models.length > 0 && <p className={`m-0 mt-1.5 text-[12px] ${muted}`}>{live.models.length} models available to this key.</p>}
          {liveState === "error" && <p className="m-0 mt-1.5 text-[12px] text-rose-500">{live.error} Showing the default list.</p>}
        </div>
      )}
    </section>
  );
}

const STATUS_STYLE = {
  active: { dot: "bg-emerald-500", text: "text-emerald-600" },
  beta: { dot: "bg-amber-500", text: "text-amber-600" },
  deprecated: { dot: "bg-rose-500", text: "text-rose-600" },
};
const capitalize = (s) => (s ? String(s).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "");

// Slide-over drawer on the right edge: the Overview tab is everything about the provider, the Configuration tab is its settings.
// With asPage the same panel fills the right pane of the Configurations tab on the LLM Providers page: no overlay or close
// button, opens on the saved-configurations list (Edit or + New opens the form), and only has the Configurations and Test tabs.
export default function ProviderConfigModal({ provider, onClose, onOpenConfigurations, asPage = false }) {
  const { rightSidebarTheme, mainSectionTheme } = useTheme();
  const isLight = (asPage ? mainSectionTheme : rightSidebarTheme) === "light";
  const surface = isLight ? "bg-white" : "bg-black";
  const configFields = provider.configuration?.fields || [];
  const parameterFields = provider.parameters?.fields || [];
  const [configValues, setConfigValues] = useState(() => initialValues(configFields));
  const [paramValues, setParamValues] = useState(() => initialValues(parameterFields));
  const [tab, setTab] = useState(asPage ? "configuration" : "provider");
  const [section, setSection] = useState(null);
  const [entered, setEntered] = useState(asPage);
  const [query, setQuery] = useState("");
  const [credentialId, setCredentialId] = useState("");
  const [model, setModel] = useState("");
  const drawerRef = useRef(null);

  // saved configurations of this provider
  const [configs, setConfigs] = useState([]);
  const [loadState, setLoadState] = useState("loading");
  const [selectedId, setSelectedId] = useState("new");
  const [name, setName] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState(() => makeSnapshot("", "", "", initialValues(configFields), initialValues(parameterFields)));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [credentialNames, setCredentialNames] = useState({}); // credential id -> name, for the configuration cards
  useEffect(() => {
    if (!provider.credentialRequired) return undefined;
    let cancelled = false;
    listCredentials()
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.content ?? [];
        if (!cancelled) setCredentialNames(Object.fromEntries(list.map((c) => [c.id, c.name])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [provider.credentialRequired]);
  const [view, setView] = useState("list"); // "list": the saved configurations, "edit": one configuration's form

  const groups = useMemo(() => buildGroups(provider), [provider]);
  const sections = useMemo(() => [...new Set(groups.map((g) => g.source))], [groups]);
  const activeSection = section && sections.includes(section) ? section : sections[0];
  const sectionLabel = (key) => groups.find((g) => g.source === key)?.sectionLabel;
  const sectionGroups = groups.filter((g) => g.source === activeSection);
  const valuesFor = (source) => (source === "configuration" ? configValues : paramValues);

  const models = useMemo(() => provider.manifest?.model_discovery?.fallback?.models || [], [provider]);
  const needsKey = Boolean(provider.credentialRequired);
  const q = query.trim().toLowerCase();
  const hasConnection = needsKey || models.length > 0;
  const onConfigSection = !activeSection || activeSection === "configuration";
  const showKey = needsKey && onConfigSection && (!q || "api key credential".includes(q) || `${provider.name} api key`.toLowerCase().includes(q));
  const showModel = models.length > 0 && onConfigSection && (!q || "model".includes(q));
  const allFields = [...configFields, ...parameterFields];
  const modifiedTotal =
    configFields.filter((f) => isModified(f, configValues[f.key])).length + parameterFields.filter((f) => isModified(f, paramValues[f.key])).length + (credentialId ? 1 : 0) + (model ? 1 : 0);
  const sectionChanged = (key) =>
    key === "configuration" ? configFields.filter((f) => isModified(f, configValues[f.key])).length + (credentialId ? 1 : 0) + (model ? 1 : 0) : parameterFields.filter((f) => isModified(f, paramValues[f.key])).length;
  const hasMatches = sectionGroups.some((g) => g.fields.some((f) => matches(f.visible_when, valuesFor(g.source)) && matchesQuery(f, q)));

  const dirty = makeSnapshot(name, credentialId, model, configValues, paramValues) !== savedSnapshot;
  const current = configs.find((c) => c.id === selectedId) ?? null;

  const applyConfig = (c) => {
    const cv = toFormValues(configFields, c.configuration);
    const pv = toFormValues(parameterFields, c.parameters);
    setName(c.name);
    setCredentialId(c.credentialId ?? "");
    setModel(c.model ?? "");
    setConfigValues(cv);
    setParamValues(pv);
    setSavedSnapshot(makeSnapshot(c.name, c.credentialId ?? "", c.model ?? "", cv, pv));
    setSelectedId(c.id);
    setChatMessages([]);
  };
  const applyBlank = () => {
    const cv = initialValues(configFields);
    const pv = initialValues(parameterFields);
    setName("");
    setCredentialId("");
    setModel("");
    setConfigValues(cv);
    setParamValues(pv);
    setSavedSnapshot(makeSnapshot("", "", "", cv, pv));
    setSelectedId("new");
    setChatMessages([]);
  };
  const refetch = async () => {
    const list = await listProviderConfigurations(provider.id);
    setConfigs(list);
    return list;
  };

  // load this provider's saved configurations and open the active one
  useEffect(() => {
    let cancelled = false;
    listProviderConfigurations(provider.id)
      .then((list) => {
        if (cancelled) return;
        setConfigs(list);
        setLoadState("ready");
        const first = list.find((c) => c.active) ?? list[0];
        if (first) applyConfig(first);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadState("error");
        setNotice({ type: "error", text: err.message || "Could not load your configurations." });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider.id]);

  const confirm = useConfirm();
  const confirmDiscard = async () =>
    !dirty || confirm({ title: "Discard changes?", message: "You have unsaved changes. They will be lost.", confirmText: "Discard", tone: "danger" });
  const run = async (action) => {
    setBusy(true);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Something went wrong." });
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    run(async () => {
      if (!name.trim()) throw new Error("Give the configuration a name.");
      const body = {
        name: name.trim(),
        credentialId: credentialId || null,
        model: model.trim() || null,
        configuration: encodeFields(configFields, configValues),
        parameters: encodeFields(parameterFields, paramValues),
      };
      const result = current ? await updateProviderConfiguration(provider.id, current.id, body) : await createProviderConfiguration(provider.id, body);
      await refetch();
      applyConfig(result);
      setNotice({ type: "ok", text: "Configuration saved." });
      setView("list");
    });
  const makeActive = (c) =>
    run(async () => {
      await activateProviderConfiguration(provider.id, c.id);
      const list = await refetch();
      const fresh = list.find((x) => x.id === selectedId);
      if (fresh && !dirty) applyConfig(fresh);
      setNotice({ type: "ok", text: `"${c.name}" is now the active configuration.` });
    });
  const removeConfig = async (c) => {
    if (!(await confirm({ title: "Delete configuration?", message: `"${c.name}" will be deleted. This cannot be undone.`, confirmText: "Delete", tone: "danger" }))) return;
    run(async () => {
      await deleteProviderConfiguration(provider.id, c.id);
      const list = await refetch();
      if (c.id === selectedId) {
        const next = list.find((x) => x.active) ?? list[0];
        if (next) applyConfig(next);
        else applyBlank();
      }
      setNotice({ type: "ok", text: "Configuration deleted." });
    });
  };
  const startNew = async () => {
    if (!(await confirmDiscard())) return;
    setNotice(null);
    applyBlank();
    setView("edit");
  };
  const editConfig = async (c) => {
    if (c.id !== selectedId && !(await confirmDiscard())) return;
    setNotice(null);
    if (c.id !== selectedId) applyConfig(c);
    setView("edit");
  };
  const testConfig = async (c) => {
    if (c.id !== selectedId && !(await confirmDiscard())) return;
    if (c.id !== selectedId) applyConfig(c);
    setTab("test");
  };
  const backToList = async () => {
    if (!(await confirmDiscard())) return;
    if (current) applyConfig(current);
    else applyBlank();
    setNotice(null);
    setView("list");
  };

  // slide in on mount, keep the page behind from scrolling, and give the drawer focus
  useEffect(() => {
    if (asPage) return undefined;
    const frame = requestAnimationFrame(() => setEntered(true));
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    drawerRef.current?.focus();
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previous;
    };
  }, [asPage]);
  const closeTimer = useRef(null);
  const close = () => {
    if (asPage) {
      onClose();
      return;
    }
    setEntered(false);
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(onClose, 180);
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (asPage) return undefined;
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asPage]);

  const meta = provider.manifest?.metadata || {};
  const docsUrl = provider.manifest?.documentation?.official || provider.website;
  const status = STATUS_STYLE[provider.status] || { dot: "bg-gray-400", text: "text-gray-500" };

  const muted = isLight ? "text-gray-500" : "text-[#8B98A8]";
  const line = isLight ? "border-[#E5E4E7]" : "border-[#263241]/60";
  const reset = () => {
    setConfigValues(initialValues(configFields));
    setParamValues(initialValues(parameterFields));
    setCredentialId("");
    setModel("");
  };

  const tabs = asPage ? [["configuration", "Configurations"], ["test", "Test"]] : [["provider", "Overview"], ["configuration", "Configurations"], ["test", "Test"]];
  // In the drawer the Configurations tab leads to the page's Configurations tab (leaving with unsaved edits asks first).
  const selectTab = async (id) => {
    if (!asPage && id === "configuration") {
      if (await confirmDiscard()) onOpenConfigurations?.(provider);
      return;
    }
    setTab(id);
  };
  const configuring = tab === "configuration" && view === "edit" && (groups.length > 0 || hasConnection);
  const iconBtn = `flex h-8 w-8 cursor-pointer items-center justify-center border-0 bg-transparent transition ${isLight ? "text-gray-500 hover:bg-black/5" : "text-[#9AA7B6] hover:bg-white/8"}`;

  return (
    <div className={asPage ? `flex h-full min-w-0 flex-1 ${surface}` : "fixed inset-0 z-50"} role="presentation">
      {!asPage && <div className={`absolute inset-0 bg-black/45 transition-opacity duration-200 ${entered ? "opacity-100" : "opacity-0"}`} onClick={close} />}

      <aside
        ref={drawerRef}
        tabIndex={-1}
        role={asPage ? "region" : "dialog"}
        aria-modal={asPage ? undefined : "true"}
        aria-label={`${provider.name} provider`}
        className={`flex flex-col outline-none ${
          asPage
            ? "h-full w-full min-w-0"
            : `absolute inset-y-0 right-0 w-full max-w-sm border-l shadow-2xl transition-transform duration-200 ease-out ${entered ? "translate-x-0" : "translate-x-full"}`
        } ${isLight ? "border-[#E5E4E7] bg-white text-gray-900" : "border-[#263241]/60 bg-black text-white"}`}
      >
        {/* title */}
        <header className={`shrink-0 border-b px-5 pt-4 ${line}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {provider.logo ? (
                <img src={provider.logo} alt="" className={`h-9 w-9 shrink-0 border object-contain p-1 ${line}`} />
              ) : (
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center border text-base font-semibold ${line} ${muted}`}>{provider.name?.charAt(0).toUpperCase()}</span>
              )}
              <div className="min-w-0">
                <h2 className="m-0 truncate text-[16px] font-semibold leading-tight">{provider.name}</h2>
                <p className={`m-0 mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] ${muted}`}>
                  <span className={`inline-flex items-center gap-1.5 font-medium ${status.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                    {capitalize(provider.status)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{capitalize(provider.category)}</span>
                  {meta.publisher && <><span aria-hidden="true">·</span><span>by {meta.publisher}</span></>}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center">
              {docsUrl && (
                <a href={docsUrl} target="_blank" rel="noopener noreferrer" aria-label="Documentation" title="Documentation" className={iconBtn}><ExternalIcon /></a>
              )}
              {!asPage && <button type="button" aria-label="Close" onClick={close} className={iconBtn}><CloseIcon /></button>}
            </div>
          </div>

          <div className="-mb-px mt-3 flex gap-5" role="tablist">
            {tabs.map(([id, label]) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectTab(id)}
                  className={`flex cursor-pointer items-center gap-2 border-0 border-b-2 bg-transparent px-0.5 pb-2.5 pt-1 text-[13.5px] transition-colors ${
                    active ? "border-(--accent-color) font-semibold text-(--accent-readable)" : `border-transparent ${muted} hover:text-inherit`
                  }`}
                >
                  {label}
                  {id === "configuration" && configs.length > 0 && (
                    <span className="rounded-full px-1.5 py-px text-[12px] font-medium text-black" style={{ backgroundImage: "var(--accent-paint)" }}>{configs.length}</span>
                  )}
                </button>
              );
            })}
          </div>
        </header>

        {/* content */}
        <div className="scrollable min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {tab === "provider" ? (
            <div className="px-5 py-5"><ProviderOverview provider={provider} isLight={isLight} /></div>
          ) : tab === "test" ? (
            <div className="flex h-full min-h-0 flex-col">
              {configs.length > 1 && (
                <div className={`shrink-0 border-b px-5 py-3 ${line}`}>
                  <Dropdown
                    id="test-config"
                    value={selectedId}
                    options={configs.map((c) => ({ value: c.id, label: c.active ? `${c.name}  ·  Active` : c.name, hint: c.model || undefined }))}
                    onChange={async (id) => id !== selectedId && (await confirmDiscard()) && applyConfig(configs.find((c) => c.id === id))}
                    isLight={isLight}
                    base={inputClass(isLight)}
                  />
                </div>
              )}
              <div className="min-h-0 flex-1">
                <ProviderChat provider={provider} configuration={current} dirty={dirty} messages={chatMessages} setMessages={setChatMessages} isLight={isLight} />
              </div>
            </div>
          ) : view === "list" ? (
            <div className="flex flex-col gap-3 px-5 py-5">
              <div className="flex items-start justify-between gap-3">
                <p className={`m-0 text-[13px] leading-snug ${muted}`}>Save several setups for {provider.name}. One of them is active.</p>
                <button type="button" onClick={startNew} disabled={loadState !== "ready" || busy} className="shrink-0 cursor-pointer border-0 px-3 py-1.5 text-[12.5px] font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundImage: "var(--accent-paint)" }}>
                  + New
                </button>
              </div>
              {notice && (
                <p className={`m-0 border px-3 py-2 text-[12.5px] leading-snug ${notice.type === "ok" ? "border-emerald-500/40 text-emerald-500" : "border-rose-500/40 text-rose-500"}`} role="status">
                  {notice.text}
                </p>
              )}
              {loadState === "loading" && <p className={`m-0 text-[13px] ${muted}`}>Loading your configurations…</p>}
              {loadState === "ready" && configs.length === 0 && (
                <div className={`flex flex-col items-center gap-3 border border-dashed px-5 py-8 text-center ${line}`}>
                  <p className="m-0 text-[14px] font-semibold">No configurations yet</p>
                  <p className={`m-0 text-[13px] leading-snug ${muted}`}>Pick an API key and a model, then save it to start using {provider.name}.</p>
                  <button type="button" onClick={startNew} className="cursor-pointer border-0 px-4 py-2 text-[13px] font-semibold text-black hover:opacity-90" style={{ backgroundImage: "var(--accent-paint)" }}>
                    Create configuration
                  </button>
                </div>
              )}
              {configs.map((c) => (
                <article
                  key={c.id}
                  className={`relative flex flex-col gap-3 border ${surface} p-4 pl-5 ${line}`}
                >
                  {c.active && <span className="absolute inset-y-0 left-0 w-0.5 bg-emerald-500" aria-hidden="true" />}
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block truncate text-[14.5px] font-semibold leading-tight">{c.name}</span>
                    </span>
                    {c.active && (
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-emerald-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Active</span>
                    )}
                  </div>
                  <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12.5px]">
                    <dt className={muted}>Model</dt>
                    <dd className="m-0 min-w-0 truncate font-medium">{c.model || "Not selected"}</dd>
                    {provider.credentialRequired && (
                      <>
                        <dt className={muted}>API key</dt>
                        <dd className="m-0 min-w-0 truncate font-medium">{c.credentialId ? credentialNames[c.credentialId] || "Saved credential" : "Not selected"}</dd>
                      </>
                    )}
                  </dl>
                  {(() => {
                    const settings = [...summarize(configFields, c.configuration), ...summarize(parameterFields, c.parameters)];
                    if (settings.length === 0) return <p className={`m-0 text-[12px] ${muted}`}>Default settings</p>;
                    return (
                      <div className="flex flex-wrap gap-1.5">
                        {settings.slice(0, 6).map((x) => (
                          <span key={x.key} title={`${x.label}: ${x.value}`} className={`inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] ${isLight ? "bg-black/5" : "bg-white/10"}`}>
                            <span className={`truncate ${muted}`}>{x.label}</span>
                            <span className="truncate font-medium">{x.value}</span>
                          </span>
                        ))}
                        {settings.length > 6 && <span className={`inline-flex items-center px-1 text-[11.5px] ${muted}`}>+{settings.length - 6} more</span>}
                      </div>
                    );
                  })()}
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => editConfig(c)} disabled={busy} className={`cursor-pointer border ${surface} px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${line} ${isLight ? "text-gray-900 hover:bg-black/4" : "text-white hover:bg-white/6"}`}>Edit</button>
                    <button type="button" onClick={() => testConfig(c)} disabled={busy} className={`cursor-pointer border ${surface} px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${line} ${isLight ? "text-gray-900 hover:bg-black/4" : "text-white hover:bg-white/6"}`}>Test</button>
                    {!c.active && (
                      <button type="button" onClick={() => makeActive(c)} disabled={busy} className={`cursor-pointer border ${surface} px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${line} text-(--accent-readable) hover:border-(--accent-color)`}>Set active</button>
                    )}
                    <button type="button" onClick={() => removeConfig(c)} disabled={busy} className="ml-auto cursor-pointer border-0 bg-transparent p-0 text-[12.5px] font-medium text-rose-500 hover:underline disabled:opacity-50">Delete</button>
                  </div>
                  {c.updatedAt && <span className={`text-[11.5px] ${muted}`}>Updated {new Date(c.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span>}
                </article>
              ))}
            </div>
          ) : groups.length === 0 && !hasConnection ? (
            <p className={`px-5 py-5 text-sm ${muted}`}>This provider has no configurable options.</p>
          ) : (
            <>
              {/* one configuration: back to the list, its name, then the form */}
              <div className={`flex flex-col gap-3 border-b px-5 pb-4 pt-4 ${line}`}>
                <div className="flex items-center justify-between gap-3">
                  <button type="button" onClick={backToList} disabled={busy} className="inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-[12.5px] font-medium text-(--accent-readable) hover:underline disabled:opacity-50">
                    <ChevronDown className="rotate-90" /> All configurations
                  </button>
                  {current?.active && (
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Active</span>
                  )}
                </div>
                <div>
                  <label htmlFor="config-name" className="mb-2 block text-[13.5px] font-semibold leading-tight">
                    Name<span className="ml-0.5 text-rose-500">*</span>
                  </label>
                  <input
                    id="config-name"
                    value={name}
                    maxLength={150}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Production, Fast and cheap"
                    autoComplete="off"
                    disabled={busy}
                    className={inputClass(isLight)}
                  />
                </div>
                {notice && (
                  <p className={`m-0 border px-3 py-2 text-[12.5px] leading-snug ${notice.type === "ok" ? "border-emerald-500/40 text-emerald-500" : "border-rose-500/40 text-rose-500"}`} role="status">
                    {notice.text}
                  </p>
                )}
              </div>

              {(sections.length > 1 || allFields.length > 5) && (
                <div className={`sticky top-0 z-10 flex flex-col gap-2.5 border-b px-5 pb-3 ${line} ${isLight ? "bg-white" : "bg-black"}`}>
                  {sections.length > 1 && (
                    <div className={`flex border ${line} ${isLight ? "bg-white" : "bg-black"}`} role="tablist" aria-label="Settings type">
                      {sections.map((key) => {
                        const active = key === activeSection;
                        return (
                          <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setSection(key)}
                            className={`relative flex flex-1 cursor-pointer items-center justify-center gap-1.5 border-0 px-3 py-2.5 text-[13px] font-medium transition-colors ${
                              active ? (isLight ? "text-gray-900" : "text-white") : `bg-transparent ${muted} ${isLight ? "hover:bg-black/3" : "hover:bg-white/3"}`
                            }`}
                          >
                            {active && <span className="absolute inset-x-0 bottom-0 h-0.5" style={{ backgroundImage: "var(--accent-paint)" }} />}
                            {sectionLabel(key)}
                            {sectionChanged(key) > 0 && <span className="h-1.5 w-1.5 rounded-full bg-(--accent-color)" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {allFields.length > 5 && (
                    <div className={`flex items-center gap-2 border px-3 py-2 transition-colors focus-within:border-(--accent-color) ${line}`}>
                      <span className={muted}><SearchIcon /></span>
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        aria-label="Search settings"
                        placeholder="Search settings"
                        className={`min-w-0 flex-1 border-0 bg-transparent text-[13.5px] outline-none ${isLight ? "placeholder:text-gray-400" : "placeholder:text-[#566273]"}`}
                      />
                      {query && (
                        <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className={`cursor-pointer border-0 bg-transparent p-0 text-lg leading-none ${muted} hover:text-inherit`}>×</button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-5 px-5 py-5">
                {(showKey || showModel) && (
                  <ConnectionBlock
                    provider={provider}
                    models={models}
                    needsKey={needsKey}
                    credentialId={credentialId}
                    setCredentialId={setCredentialId}
                    model={model}
                    setModel={setModel}
                    showKey={showKey}
                    showModel={showModel}
                    isLight={isLight}
                  />
                )}
                {!hasMatches && !showKey && !showModel && <p className={`m-0 text-sm ${muted}`}>No settings match "{query}".</p>}
                {sectionGroups.map((group) => (
                  <GroupBlock
                    key={group.id}
                    group={group}
                    query={q}
                    values={valuesFor(group.source)}
                    setValues={group.source === "configuration" ? setConfigValues : setParamValues}
                    isLight={isLight}
                    showHeading={sectionGroups.length > 1}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* footer */}
        {tab !== "test" && !(tab === "configuration" && view === "list") && (
        <footer className={`flex shrink-0 items-center justify-between gap-3 border-t px-5 py-3 ${line}`}>
          {configuring ? (
            <span className="flex items-center gap-3 text-[12.5px]">
              <span className={dirty ? "text-amber-500" : muted}>{dirty ? "Unsaved changes" : current ? "Saved" : modifiedTotal === 0 ? "All defaults" : `${modifiedTotal} changed`}</span>
              {modifiedTotal > 0 && (
                <button type="button" onClick={reset} className="cursor-pointer border-0 bg-transparent p-0 font-medium text-(--accent-readable) hover:underline">Reset all</button>
              )}
            </span>
          ) : <span />}
          {configuring ? (
            <button
              type="button"
              onClick={save}
              disabled={busy || loadState !== "ready" || (Boolean(current) && !dirty)}
              className="cursor-pointer border-0 px-5 py-2 text-[13.5px] font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundImage: "var(--accent-paint)" }}
            >
              {busy ? "Saving…" : current ? "Save changes" : "Create configuration"}
            </button>
          ) : asPage ? <span /> : (
            <button
              type="button"
              onClick={close}
              className="cursor-pointer border-0 px-5 py-2 text-[13.5px] font-semibold text-black transition hover:opacity-90"
              style={{ backgroundImage: "var(--accent-paint)" }}
            >
              Done
            </button>
          )}
        </footer>
        )}
      </aside>
    </div>
  );
}
