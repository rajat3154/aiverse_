import { useState } from "react";

// Friendly editors for settings that are JSON underneath, so nobody has to type braces and quotes:
//  - a list ("array") is a row of chips: type a value, press Enter
//  - a set of named values ("object") is a table of name / value rows with an Add button
// "Edit as JSON" is still there for people who want it, and is used automatically when the stored value is more complex
// than the simple editors can show. The form value stays a JSON string, as before.

const XIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
);

const parse = (text) => {
  if (text === "" || text == null) return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
};
const isScalar = (v) => ["string", "number", "boolean"].includes(typeof v);
const asList = (parsed) => (parsed.ok && (parsed.value === undefined || (Array.isArray(parsed.value) && parsed.value.every(isScalar))) ? (parsed.value ?? []).map(String) : null);
const asRows = (parsed) =>
  parsed.ok && (parsed.value === undefined || (parsed.value && typeof parsed.value === "object" && !Array.isArray(parsed.value) && Object.values(parsed.value).every(isScalar)))
    ? Object.entries(parsed.value ?? {}).map(([key, value]) => ({ key, value: String(value) }))
    : null;

// "true" / "false" / numbers become real booleans and numbers; everything else stays text
const coerce = (text) => {
  const t = text.trim();
  if (t === "true") return true;
  if (t === "false") return false;
  if (t !== "" && /^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return text;
};
const serializeRows = (rows) => {
  const out = {};
  rows.forEach(({ key, value }) => {
    if (key.trim()) out[key.trim()] = coerce(value);
  });
  return Object.keys(out).length ? JSON.stringify(out) : "";
};

function Chips({ items, onChange, placeholder, isLight, base }) {
  const [draft, setDraft] = useState("");
  const add = (raw) => {
    const parts = raw.split(/[\n,]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length) onChange([...items, ...parts.filter((p) => !items.includes(p))]);
    setDraft("");
  };
  return (
    <div className={`${base} flex min-h-11 flex-wrap items-center gap-1.5 py-1.5`}>
      {items.map((item) => (
        <span key={item} className={`inline-flex max-w-full items-center gap-1.5 border py-0.5 pl-2 pr-1 text-[12.5px] ${isLight ? "border-[#E5E4E7] bg-white" : "border-[#263241] bg-black"}`}>
          <span className="truncate">{item}</span>
          <button type="button" aria-label={`Remove ${item}`} onClick={() => onChange(items.filter((i) => i !== item))} className="flex cursor-pointer items-center border-0 bg-transparent p-0.5 opacity-60 hover:opacity-100">
            <XIcon />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(draft);
          } else if (e.key === "Backspace" && draft === "" && items.length) {
            onChange(items.slice(0, -1));
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (/[\n,]/.test(text)) {
            e.preventDefault();
            add(text);
          }
        }}
        placeholder={items.length ? "" : placeholder}
        aria-label="Add a value"
        className="min-w-24 flex-1 border-0 bg-transparent py-1 text-[13.5px] outline-none"
      />
    </div>
  );
}

function Rows({ value, onChange, isLight, base }) {
  const [rows, setRows] = useState(() => asRows(parse(value)) ?? []);
  // the form value changed from outside (another configuration was opened, or Reset): start over from it
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value !== serializeRows(rows)) setRows(asRows(parse(value)) ?? []);
  }
  const update = (next) => {
    setRows(next);
    onChange(serializeRows(next));
  };
  const muted = isLight ? "text-gray-500" : "text-[#8B98A8]";
  return (
    <div className="flex flex-col gap-2">
      {rows.length > 0 && (
        <div className={`grid grid-cols-[1fr_1fr_auto] gap-2 text-[12px] ${muted}`}>
          <span>Name</span>
          <span>Value</span>
          <span className="w-8" />
        </div>
      )}
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
          <input value={row.key} onChange={(e) => update(rows.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))} placeholder="e.g. user" aria-label="Name" autoComplete="off" className={base} />
          <input value={row.value} onChange={(e) => update(rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))} placeholder="e.g. 42" aria-label="Value" autoComplete="off" className={base} />
          <button type="button" aria-label="Remove this row" onClick={() => update(rows.filter((_, j) => j !== i))} className={`flex h-10 w-8 cursor-pointer items-center justify-center border-0 bg-transparent hover:text-rose-500 ${muted}`}>
            <XIcon />
          </button>
        </div>
      ))}
      <button type="button" onClick={() => setRows([...rows, { key: "", value: "" }])} className="w-fit cursor-pointer border-0 bg-transparent p-0 text-[12.5px] font-medium text-(--accent-readable) hover:underline">
        + Add {rows.length ? "another" : "an item"}
      </button>
    </div>
  );
}

export default function JsonField({ id, field, value, onChange, isLight, base, problem }) {
  const text = value ?? "";
  const parsed = parse(text);
  const simple = field.type === "array" ? asList(parsed) !== null : asRows(parsed) !== null;
  const [raw, setRaw] = useState(false);

  const muted = isLight ? "text-gray-500" : "text-[#8B98A8]";
  const showRaw = raw || !simple;
  const example = field.type === "array" ? '["value1", "value2"]' : '{"key": "value"}';

  return (
    <div>
      {showRaw ? (
        <>
          <textarea
            id={id}
            rows={4}
            value={text}
            placeholder={field.placeholder ?? example}
            disabled={Boolean(field.disabled)}
            spellCheck={false}
            onChange={(e) => onChange(e.target.value)}
            className={`${base} resize-y text-[13px] ${problem ? "border-rose-400!" : ""}`}
          />
          {problem && <p className="mt-1.5 text-[12px] text-rose-500">{problem}</p>}
        </>
      ) : field.type === "array" ? (
        <Chips items={asList(parsed)} onChange={(items) => onChange(items.length ? JSON.stringify(items) : "")} placeholder="Type a value and press Enter" isLight={isLight} base={base} />
      ) : (
        <Rows value={text} onChange={onChange} isLight={isLight} base={base} />
      )}
      <div className="mt-1.5 flex items-center justify-between gap-3">
        <span className={`text-[12px] ${muted}`}>
          {showRaw ? (simple ? "Editing as JSON." : "This value needs the JSON editor.") : field.type === "array" ? "Press Enter after each value." : "Add a name and a value for each item."}
        </span>
        {simple && (
          <button type="button" onClick={() => setRaw((v) => !v)} className="cursor-pointer border-0 bg-transparent p-0 text-[12px] font-medium text-(--accent-readable) hover:underline">
            {raw ? "Use the simple editor" : "Edit as JSON"}
          </button>
        )}
      </div>
    </div>
  );
}
