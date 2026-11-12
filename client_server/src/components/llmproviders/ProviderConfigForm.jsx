import { useMemo, useState } from "react";

// Renders a provider's configuration and parameter forms straight from the manifest definition
// (groups + fields), so a new provider needs no frontend change.

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
const normalizeOptions = (options = []) =>
  options.map((o) => (typeof o === "object" ? { value: o.value, label: o.label ?? String(o.value) } : { value: o, label: String(o) }));

function matches(condition, values) {
  if (!condition) return true;
  return Object.entries(condition).every(([key, expected]) => (Array.isArray(expected) ? expected.includes(values[key]) : values[key] === expected));
}

const initialValues = (fields) => Object.fromEntries(fields.map((f) => [f.key, f.default ?? (f.type === "boolean" ? false : "")]));

function Field({ field, value, onChange, isLight }) {
  const base = `w-full border px-3 py-2 text-sm outline-none ${
    isLight ? "bg-white border-black/10 text-gray-900 placeholder:text-gray-400" : "bg-black border-white/10 text-white placeholder:text-[#8B98A8]"
  } disabled:opacity-50`;
  const id = `field-${field.key}`;
  const disabled = Boolean(field.disabled);
  const input = field.input;

  if (input === "switch" || input === "checkbox") {
    return (
      <input id={id} type="checkbox" checked={Boolean(value)} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 cursor-pointer accent-(--accent-color)" />
    );
  }
  if (input === "select" || input === "radio") {
    return (
      <select id={id} value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={base}>
        {!field.required && <option value="">Default</option>}
        {normalizeOptions(field.options).map((o) => (
          <option key={String(o.value)} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  }
  if (input === "textarea" || input === "json" || input === "code") {
    return <textarea id={id} rows={4} value={value ?? ""} placeholder={field.placeholder ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={`${base} font-mono`} />;
  }
  // sliders in the manifest are shown as plain number inputs, with the allowed range in the placeholder
  if (input === "number" || input === "slider") {
    return (
      <input
        id={id}
        type="number"
        value={value ?? ""}
        min={field.minimum}
        max={field.maximum}
        step={field.step}
        placeholder={field.placeholder ?? (field.minimum !== undefined && field.maximum !== undefined ? `${field.minimum} – ${field.maximum}` : "")}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
        className={base}
      />
    );
  }
  return (
    <input
      id={id}
      type={input === "password" ? "password" : input === "url" ? "url" : "text"}
      value={value ?? ""}
      placeholder={field.placeholder ?? ""}
      disabled={disabled}
      autoComplete="off"
      onChange={(e) => onChange(e.target.value)}
      className={base}
    />
  );
}

function FormSection({ title, definition, values, setValues, showAdvanced, isLight }) {
  const fields = (definition?.fields || []).filter((f) => f.supported !== false);
  const groups = [...(definition?.groups || [])].sort(byOrder);
  const grouped = groups.map((g) => ({ ...g, fields: fields.filter((f) => f.group === g.key).sort(byOrder) }));
  const ungrouped = fields.filter((f) => !groups.some((g) => g.key === f.group)).sort(byOrder);
  if (ungrouped.length) grouped.push({ key: "_other", label: "Other", fields: ungrouped });

  const visibleGroups = grouped
    .map((g) => ({ ...g, fields: g.fields.filter((f) => (showAdvanced || !f.advanced) && matches(f.visible_when, values)) }))
    .filter((g) => g.fields.length > 0);
  if (visibleGroups.length === 0) return null;

  const muted = isLight ? "text-gray-500" : "text-[#8B98A8]";
  return (
    <section className="mb-6">
      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider">{title}</h3>
      {visibleGroups.map((group) => (
        <fieldset key={group.key} className={`mb-4 border p-4 ${isLight ? "border-black/8" : "border-white/10"}`}>
          <legend className="px-1 text-[13px] font-semibold">{group.label}</legend>
          {group.description && <p className={`-mt-1 mb-3 text-[12px] ${muted}`}>{group.description}</p>}
          <div className="grid gap-4">
            {group.fields.map((field) => {
              const inline = field.input === "switch" || field.input === "checkbox";
              return (
                <div key={field.key} className={inline ? "flex items-center justify-between gap-4" : ""}>
                  <label htmlFor={`field-${field.key}`} className="mb-1 block text-[12.5px] font-medium">
                    {field.label}
                    {field.required && <span className="ml-0.5 text-rose-400">*</span>}
                    {(field.description || field.help_text) && <span className={`block font-normal ${muted}`}>{field.help_text || field.description}</span>}
                  </label>
                  <Field field={field} value={values[field.key]} onChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))} isLight={isLight} />
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
    </section>
  );
}

// Inline configuration preview for one provider (rendered inside the expanded table row).
export default function ProviderConfigForm({ provider, isLight }) {
  const configFields = provider.configuration?.fields || [];
  const parameterFields = provider.parameters?.fields || [];
  const [configValues, setConfigValues] = useState(() => initialValues(configFields));
  const [paramValues, setParamValues] = useState(() => initialValues(parameterFields));
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hasAdvanced = useMemo(() => [...configFields, ...parameterFields].some((f) => f.advanced), [configFields, parameterFields]);
  const muted = isLight ? "text-gray-500" : "text-[#9AA7B6]";

  if (configFields.length === 0 && parameterFields.length === 0) {
    return <div className={`text-[12.5px] ${muted}`}>No configuration fields.</div>;
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        {hasAdvanced ? (
          <label className="flex cursor-pointer items-center gap-2 text-[12.5px]">
            <input type="checkbox" checked={showAdvanced} onChange={(e) => setShowAdvanced(e.target.checked)} className="accent-(--accent-color)" />
            Show advanced options
          </label>
        ) : <span />}
        <button
          type="button"
          onClick={() => { setConfigValues(initialValues(configFields)); setParamValues(initialValues(parameterFields)); }}
          className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] font-medium text-(--accent-readable) hover:underline"
        >
          Reset to defaults
        </button>
      </div>
      <FormSection title="Configuration" definition={provider.configuration} values={configValues} setValues={setConfigValues} showAdvanced={showAdvanced} isLight={isLight} />
      <FormSection title="Default parameters" definition={provider.parameters} values={paramValues} setValues={setParamValues} showAdvanced={showAdvanced} isLight={isLight} />
    </div>
  );
}
