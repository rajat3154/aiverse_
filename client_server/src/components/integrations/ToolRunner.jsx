import { useEffect, useId, useMemo, useState } from "react";
import { useConfirm } from "../../hooks/useConfirm";
import { listCredentials } from "../../services/credentialService";
import { executeTool, getTool, testTool } from "../../services/integrationService";
import { getStyles, STATUS_TONES } from "./styles";
import DocumentResults from "./DocumentResults";
import { isDocumentOutput } from "./format";
import { Chip, Skeleton, ToolkitLogo } from "./ui";

const MAX_OUTPUT_CHARS = 20_000;

// ---- schema helpers: turn JSON Schema into plain-language inputs -------------------------------------------------

const ACRONYMS = new Map(
  ["ID", "IDs", "URL", "URLs", "URI", "API", "UI", "IP", "HTML", "JSON", "CSV", "SMS", "SSL", "SQL", "UUID", "PDF", "XML", "UTM"].map((word) => [word.toLowerCase(), word]),
);

/** "profile_pic_url" -> "Profile pic URL", "firstName" -> "First name": field names as people would write them. */
function humanize(name) {
  const words = String(name)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .map((word) => ACRONYMS.get(word.toLowerCase()) ?? word.toLowerCase());
  if (words.length === 0) return String(name);
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(" ");
}

const COMPOSITE = ["anyOf", "oneOf", "allOf"];
const hasProps = (def) => Boolean(def?.properties && Object.keys(def.properties).length);

const isNullBranch = (branch) => branch?.type === "null" || (Array.isArray(branch?.type) && branch.type.length === 1 && branch.type[0] === "null");

function lookupRef(root, ref) {
  if (typeof ref !== "string" || !ref.startsWith("#/")) return null;
  return ref.slice(2).split("/").reduce((node, part) => (node ? node[part.replace(/~1/g, "/").replace(/~0/g, "~")] : undefined), root) ?? null;
}

/**
 * Makes a JSON Schema easy to render as a form: $ref is followed, allOf is merged, and anyOf/oneOf is simplified.
 * "X or nothing" (the usual way an optional field is written) becomes just X. Genuine alternatives (text OR a group of
 * fields) are kept as `__union` so the form can ask the user which one they mean instead of showing raw JSON.
 */
function normalizeSchema(def, root = def, depth = 0) {
  if (!def || typeof def !== "object" || depth > 14) return def && typeof def === "object" ? { ...def } : {};
  let node = { ...def };
  if (node.$ref) {
    const { $ref, ...rest } = node;
    node = { ...(lookupRef(root, $ref) ?? {}), ...rest };
  }
  if (Array.isArray(node.allOf)) {
    const { allOf, ...rest } = node;
    node = allOf.map((part) => normalizeSchema(part, root, depth + 1)).reduce(
      (merged, part) => ({
        ...merged,
        ...part,
        properties: { ...merged.properties, ...part.properties },
        required: [...new Set([...(merged.required ?? []), ...(part.required ?? [])])],
      }),
      rest,
    );
    if (!Object.keys(node.properties ?? {}).length) delete node.properties;
  }
  const unionKey = node.anyOf ? "anyOf" : node.oneOf ? "oneOf" : null;
  if (unionKey) {
    const { [unionKey]: options, ...rest } = node;
    const branches = options.map((option) => normalizeSchema(option, root, depth + 1)).filter((option) => !isNullBranch(option));
    if (branches.length === 0) return { ...rest, type: "string" };
    if (branches.length === 1) return { ...branches[0], ...Object.fromEntries(Object.entries(rest).filter(([, value]) => value !== undefined)) };
    return { ...rest, __union: branches };
  }
  if (node.properties) {
    node.properties = Object.fromEntries(Object.entries(node.properties).map(([key, child]) => [key, normalizeSchema(child, root, depth + 1)]));
  }
  if (node.items) node.items = normalizeSchema(node.items, root, depth + 1);
  if (node.additionalProperties && typeof node.additionalProperties === "object") {
    node.additionalProperties = normalizeSchema(node.additionalProperties, root, depth + 1);
  }
  return node;
}

/** The one type the editor works with. Composite schemas (anyOf, ...) fall back to raw JSON. */
function primaryType(def) {
  if (!def) return "string";
  if (def.__union) return "union";
  if (COMPOSITE.some((key) => def[key])) return "json";
  const declared = Array.isArray(def.type) ? def.type.find((t) => t !== "null") : def.type;
  if (declared) return declared;
  if (def.properties) return "object";
  if (def.items) return "array";
  return "string";
}

const PLAIN = { string: "text", integer: "whole number", number: "number", boolean: "yes / no", json: "structured data", union: "choose one" };
const PLURAL = { string: "text values", integer: "whole numbers", number: "numbers", boolean: "yes / no values", object: "groups of fields", array: "lists", json: "structured values", union: "values" };

/** Short, non-technical name for the type chip. */
function friendlyType(def) {
  if (Array.isArray(def?.enum)) return "choice";
  const type = primaryType(def);
  if (type === "array") return `list of ${PLURAL[primaryType(def.items ?? {})] ?? "values"}`;
  if (type === "object") return hasProps(def) ? "group of fields" : "key–value pairs";
  return PLAIN[type] ?? type;
}

/** A sentence shown under complex fields so nobody has to guess what a "list" or "dictionary" is. */
function explain(def) {
  if (Array.isArray(def?.enum)) return null;
  const type = primaryType(def);
  if (type === "array") {
    const itemType = primaryType(def.items ?? {});
    return itemType === "object"
      ? "A list. Use “Add item” for each entry; every entry has its own fields."
      : "A list. Use “Add item” for each entry. Leave it empty to skip it.";
  }
  if (type === "object") {
    return hasProps(def)
      ? "A group of related fields. Fill in the ones you need."
      : "Key–value pairs. Each row is a name (the key) and what it is set to (the value).";
  }
  if (type === "union") return "This can be given in more than one way. Choose the one you want to use.";
  if (type === "json") return "This option cannot be shown as a form, so it takes structured data (JSON). Start from the example and change the values.";
  return null;
}

/** A sample value for a schema, used as the starting point for the rare fields that must be typed as JSON. */
function exampleFor(def, depth = 0) {
  if (!def || depth > 4) return null;
  if (def.example !== undefined) return def.example;
  if (def.default !== undefined) return def.default;
  if (Array.isArray(def.enum) && def.enum.length) return def.enum[0];
  const type = primaryType(def);
  if (type === "object") {
    return Object.fromEntries(Object.entries(def.properties ?? {}).slice(0, 6).map(([key, child]) => [key, exampleFor(child, depth + 1)]));
  }
  if (type === "array") return [exampleFor(def.items ?? {}, depth + 1)];
  if (type === "union") return exampleFor(def.__union[0], depth + 1);
  if (type === "integer" || type === "number") return 0;
  if (type === "boolean") return false;
  return "text";
}

/** Names for the choices of a union: the schema's own title, else what it is ("Text", "Group of fields"). */
function branchLabels(def) {
  const names = def.__union.map((branch) => {
    const name = branch.title || friendlyType(branch);
    return name.charAt(0).toUpperCase() + name.slice(1);
  });
  return names.map((name, index) => (names.indexOf(name) === index ? name : `${name} ${index + 1}`));
}

const emptyFor = (def) => {
  const type = primaryType(def);
  if (type === "union") return undefined;
  if (type === "object") return hasProps(def) ? {} : [];
  if (type === "array") return [];
  return "";
};

const dictValue = (def, raw, problems, path) => {
  const type = primaryType(def ?? {});
  if (type === "integer" || type === "number") {
    const number = Number(raw);
    if (raw === "" || Number.isNaN(number)) {
      problems.push(`${path} must be a number`);
      return raw;
    }
    return type === "integer" ? Math.trunc(number) : number;
  }
  if (type === "boolean") return raw === "true";
  if (["object", "array", "json"].includes(type)) {
    try {
      return JSON.parse(raw);
    } catch {
      problems.push(`${path} must be valid JSON`);
      return raw;
    }
  }
  return raw ?? "";
};

/** Form value -> API value. Returns undefined for "left empty" so the server can say whether it was required. */
function toArg(def, raw, problems, path) {
  const type = primaryType(def);
  if (Array.isArray(def?.enum)) {
    if (raw === undefined || raw === "") return undefined;
    const match = def.enum.find((option) => String(option) === raw);
    return match === undefined ? raw : match;
  }
  if (type === "boolean") return raw === undefined || raw === "" ? undefined : raw === "true";
  if (type === "integer" || type === "number") {
    if (raw === undefined || raw === "") return undefined;
    const number = Number(raw);
    if (Number.isNaN(number)) {
      problems.push(`${path} must be a number`);
      return undefined;
    }
    return type === "integer" ? Math.trunc(number) : number;
  }
  if (type === "array") {
    const items = (Array.isArray(raw) ? raw : [])
      .map((item, index) => toArg(def.items ?? {}, item, problems, `${path} #${index + 1}`))
      .filter((item) => item !== undefined);
    return items.length ? items : undefined;
  }
  if (type === "object") {
    if (hasProps(def)) {
      const out = {};
      Object.entries(def.properties).forEach(([key, child]) => {
        const value = toArg(child, raw?.[key], problems, `${path}.${key}`);
        if (value !== undefined) out[key] = value;
      });
      return Object.keys(out).length ? out : undefined;
    }
    const out = {};
    (Array.isArray(raw) ? raw : []).forEach((row) => {
      const key = (row?.key ?? "").trim();
      if (key) out[key] = dictValue(def.additionalProperties, row.value ?? "", problems, `${path}.${key}`);
    });
    return Object.keys(out).length ? out : undefined;
  }
  if (type === "union") {
    if (!raw || raw.branch === undefined) return undefined;
    return toArg(def.__union[raw.branch], raw.value, problems, path);
  }
  if (type === "json") {
    if (!raw || !raw.trim()) return undefined;
    try {
      return JSON.parse(raw);
    } catch {
      problems.push(`${path} must be valid JSON`);
      return undefined;
    }
  }
  return raw === undefined || raw === "" ? undefined : raw;
}

/** The whole form -> the arguments object, or a list of what is wrong with it. */
function buildArguments(fields, values) {
  const args = {};
  const problems = [];
  fields.forEach(([name, definition]) => {
    const value = toArg(definition, values[name], problems, name);
    if (value !== undefined) args[name] = value;
  });
  return { args, problems };
}

// ---- editors -------------------------------------------------------------------------------------------------------

function InfoTip({ name, hint, styles }) {
  const tipId = useId();
  if (hint.length === 0) return null;
  return (
    // Details live behind an info icon: they show on hover and on keyboard focus.
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={`About ${name}`}
        aria-describedby={tipId}
        className={`flex h-4 w-4 cursor-help items-center justify-center rounded-full border bg-transparent p-0 text-[10px] font-semibold leading-none ${styles.muted} ${styles.divider} hover:text-(--accent-readable) focus-visible:border-(--accent-color) focus-visible:outline-none`}
      >
        i
      </button>
      <span
        id={tipId}
        role="tooltip"
        className={`pointer-events-none absolute left-0 top-full z-20 mt-1.5 hidden w-60 border p-2.5 text-[11.5px] font-normal leading-snug shadow-xl group-focus-within:block group-hover:block ${styles.surface}`}
      >
        {hint.map((line) => (
          <span key={line} className="block">{line}</span>
        ))}
      </span>
    </span>
  );
}

/** One simple value: choice, yes/no, number, text, or raw JSON. */
function PrimitiveInput({ def, value, onChange, styles, placeholder, label }) {
  const type = primaryType(def);
  const base = `${styles.input} w-full py-1.5 sm:text-xs`;
  if (Array.isArray(def?.enum)) {
    return (
      <select aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={base}>
        <option value="">Select…</option>
        {def.enum.map((option) => (
          <option key={String(option)} value={String(option)}>{String(option)}</option>
        ))}
      </select>
    );
  }
  if (type === "boolean") {
    return (
      <select aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={base}>
        <option value="">(not set)</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    );
  }
  if (type === "json") {
    const example = JSON.stringify(exampleFor(def), null, 2);
    return (
      <div className="flex flex-col gap-1.5">
        <textarea aria-label={label} value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={4} spellCheck={false} placeholder={example} className={`${base} font-mono`} />
        <div>
          <button type="button" className={styles.link} onClick={() => onChange(example)}>Start from the example</button>
        </div>
      </div>
    );
  }
  return (
    <input
      aria-label={label}
      type={type === "integer" || type === "number" ? "number" : "text"}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? (def?.default !== undefined ? `default: ${JSON.stringify(def.default)}` : "")}
      className={base}
    />
  );
}

const RemoveButton = ({ onClick, label, styles }) => (
  <button type="button" onClick={onClick} aria-label={label} title={label} className={`${styles.button} shrink-0 px-2`}>✕</button>
);

function ListEditor({ def, value, onChange, styles, name }) {
  const items = Array.isArray(value) ? value : [];
  const itemDef = def.items ?? {};
  const itemType = primaryType(itemDef);
  const nested = itemType === "object" || itemType === "array";
  const update = (index, next) => onChange(items.map((item, i) => (i === index ? next : item)));
  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && <p className={`m-0 text-[12px] ${styles.muted}`}>No items yet.</p>}
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className={`mt-2 w-5 shrink-0 text-right text-[11px] ${styles.muted}`}>{index + 1}.</span>
          <div className={`min-w-0 flex-1 ${nested ? `border p-3 ${styles.divider}` : ""}`}>
            <ValueEditor def={itemDef} value={item} onChange={(next) => update(index, next)} styles={styles} name={`${name} item ${index + 1}`} />
          </div>
          <RemoveButton onClick={() => onChange(items.filter((_, i) => i !== index))} label={`Remove item ${index + 1}`} styles={styles} />
        </div>
      ))}
      <div>
        <button type="button" className={styles.link} onClick={() => onChange([...items, emptyFor(itemDef)])}>+ Add item</button>
      </div>
    </div>
  );
}

function KeyValueEditor({ def, value, onChange, styles, name }) {
  const rows = Array.isArray(value) ? value : [];
  const valueDef = def.additionalProperties && typeof def.additionalProperties === "object" ? def.additionalProperties : { type: "string" };
  const update = (index, patch) => onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  return (
    <div className="flex flex-col gap-2">
      {rows.length === 0 && <p className={`m-0 text-[12px] ${styles.muted}`}>No rows yet.</p>}
      {rows.map((row, index) => (
        <div key={index} className="flex items-start gap-2">
          <input
            aria-label={`${name} key ${index + 1}`}
            value={row.key ?? ""}
            onChange={(e) => update(index, { key: e.target.value })}
            placeholder="key"
            className={`${styles.input} w-2/5 min-w-0 py-1.5 font-mono sm:text-xs`}
          />
          <div className="min-w-0 flex-1">
            <PrimitiveInput def={valueDef} value={row.value} onChange={(next) => update(index, { value: next })} styles={styles} placeholder="value" label={`${name} value ${index + 1}`} />
          </div>
          <RemoveButton onClick={() => onChange(rows.filter((_, i) => i !== index))} label={`Remove row ${index + 1}`} styles={styles} />
        </div>
      ))}
      <div>
        <button type="button" className={styles.link} onClick={() => onChange([...rows, { key: "", value: "" }])}>+ Add row</button>
      </div>
    </div>
  );
}

function GroupEditor({ def, value, onChange, styles }) {
  const required = new Set(def.required ?? []);
  const entries = Object.entries(def.properties).sort(([a], [b]) => Number(required.has(b)) - Number(required.has(a)) || a.localeCompare(b));
  const current = value && !Array.isArray(value) ? value : {};
  return (
    <div className={`flex flex-col gap-3 border-l pl-3 ${styles.divider}`}>
      {entries.map(([key, child]) => (
        <Field key={key} name={key} definition={child} required={required.has(key)} value={current[key]} onChange={(next) => onChange({ ...current, [key]: next })} styles={styles} />
      ))}
    </div>
  );
}

/** "Choose one": the user picks which way to provide the value, then fills in just that form. */
function UnionEditor({ def, value, onChange, styles, name }) {
  const labels = branchLabels(def);
  const chosen = value?.branch;
  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label={`${name}: choose one`} className="flex flex-wrap gap-2">
        {labels.map((label, index) => (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={chosen === index}
            onClick={() => onChange(chosen === index ? undefined : { branch: index, value: emptyFor(def.__union[index]) })}
            className={`cursor-pointer border px-3 py-1.5 text-[12.5px] transition-colors max-sm:min-h-10 ${
              chosen === index ? "border-(--accent-color) font-semibold text-(--accent-readable)" : `bg-transparent ${styles.divider} ${styles.body}`
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {chosen !== undefined && (
        <ValueEditor def={def.__union[chosen]} value={value.value} onChange={(next) => onChange({ branch: chosen, value: next })} styles={styles} name={`${name} (${labels[chosen]})`} />
      )}
    </div>
  );
}

function ValueEditor({ def, value, onChange, styles, name }) {
  const type = primaryType(def);
  if (type === "union") return <UnionEditor def={def} value={value} onChange={onChange} styles={styles} name={name} />;
  if (!Array.isArray(def?.enum)) {
    if (type === "array") return <ListEditor def={def} value={value} onChange={onChange} styles={styles} name={name} />;
    if (type === "object") {
      return hasProps(def)
        ? <GroupEditor def={def} value={value} onChange={onChange} styles={styles} />
        : <KeyValueEditor def={def} value={value} onChange={onChange} styles={styles} name={name} />;
    }
  }
  return <PrimitiveInput def={def} value={value} onChange={onChange} styles={styles} label={name} />;
}

function Field({ name, definition, required, invalid, value, onChange, styles }) {
  const explanation = explain(definition);
  const hint = [
    definition?.description,
    `Field name: ${name}`,
    definition?.default !== undefined ? `Default: ${JSON.stringify(definition.default)}` : null,
    Array.isArray(definition?.enum) ? `Allowed: ${definition.enum.slice(0, 8).map((option) => String(option)).join(", ")}` : null,
  ].filter(Boolean);
  const type = primaryType(definition);
  const complex = !Array.isArray(definition?.enum) && (type === "array" || type === "object" || type === "union");
  const Wrapper = complex ? "div" : "label"; // a <label> must not wrap several controls
  return (
    <Wrapper className="flex flex-col gap-1.5">
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[13px] font-medium">
          {humanize(name)}
          {required && <span className="ml-0.5 text-rose-400" aria-hidden="true">*</span>}
          {required && <span className="sr-only"> (required)</span>}
        </span>
        {!required && <span className={`text-[11px] ${styles.muted}`}>optional</span>}
        {/* simple values (text, number, yes/no) need no label; lists and groups say what they are */}
        {complex && <Chip className={styles.chip}>{friendlyType(definition)}</Chip>}
        <InfoTip name={name} hint={hint} styles={styles} />
      </span>
      {explanation && <span className={`text-[11.5px] leading-snug ${styles.muted}`}>{explanation}</span>}
      <ValueEditor def={definition} value={value} onChange={onChange} styles={styles} name={humanize(name)} />
      {invalid && <span className="text-[11px] text-rose-400">This field is required.</span>}
    </Wrapper>
  );
}

const CHECK_MARK = { passed: "✓", failed: "✕", skipped: "–" };
const CHECK_TONE = { passed: "text-emerald-400", failed: "text-rose-400", skipped: "text-[#7C8AA0]" };

// Form + dry run + real run for one tool. Mount with key={tool.id} so each tool starts clean.
export default function ToolRunner({ tool, toolkit, accounts, isLight, onClose, onConnect }) {
  const styles = getStyles(isLight);
  const confirm = useConfirm();
  const [loaded, setLoaded] = useState({ id: null, detail: null, error: "" });
  const [values, setValues] = useState({});
  const [accountId, setAccountId] = useState("");
  const [credentials, setCredentials] = useState(null); // the user's saved credentials, loaded when the tool can use one
  const [credentialId, setCredentialId] = useState("");
  const [busy, setBusy] = useState(null); // "dry" | "run"
  const [report, setReport] = useState(null);
  const [result, setResult] = useState(null);
  const [failure, setFailure] = useState(null); // { message, code, candidates, retryAfter }
  const [attempted, setAttempted] = useState(false); // after the first Dry run / Run, empty required fields are flagged
  const [showOptional, setShowOptional] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getTool(tool.id)
      .then((detail) => !cancelled && setLoaded({ id: tool.id, detail, error: "" }))
      .catch((e) => !cancelled && setLoaded({ id: tool.id, detail: null, error: e.message }));
    return () => {
      cancelled = true;
    };
  }, [tool.id]);

  const ready = loaded.id === tool.id;
  const rawSchema = ready ? loaded.detail?.input_schema : null;
  const schema = useMemo(() => normalizeSchema(rawSchema ?? {}), [rawSchema]);
  const required = useMemo(() => new Set(schema.required ?? tool.required_parameters ?? []), [schema.required, tool.required_parameters]);
  const fields = useMemo(
    () => Object.entries(schema.properties ?? {}).sort(([a], [b]) => Number(required.has(b)) - Number(required.has(a)) || a.localeCompare(b)),
    [schema.properties, required],
  );
  // Required inputs first, then the optional ones (collapsed when there are many).
  const requiredFields = fields.filter(([name]) => required.has(name));
  const optionalFields = fields.filter(([name]) => !required.has(name));
  const optionalOpen = showOptional || requiredFields.length === 0 || optionalFields.length <= 3;
  const isEmpty = (name) => toArg(schema.properties?.[name], values[name], [], name) === undefined;
  // Tools that use an API key from the Credentials page (e.g. YouTube) declare it in auth_requirements.credential.
  const credentialSpec = ready ? loaded.detail?.auth_requirements?.credential ?? null : null;
  const storageKey = `aiverse.tool-credential.${tool.provider_key ?? toolkit?.provider_key ?? "tool"}`;
  useEffect(() => {
    if (!credentialSpec) return undefined;
    let cancelled = false;
    listCredentials()
      .then((list) => {
        if (cancelled) return;
        const usable = (Array.isArray(list) ? list : []).filter((c) => c.status === "ACTIVE" && c.storageType === "ENCRYPTED" && c.type === "API_KEY");
        usable.sort((a, b) => Number(b.identifier === credentialSpec.identifier) - Number(a.identifier === credentialSpec.identifier) || a.name.localeCompare(b.name));
        setCredentials(usable);
        let remembered = "";
        try {
          remembered = localStorage.getItem(storageKey) ?? "";
        } catch {
          remembered = "";
        }
        setCredentialId(usable.some((c) => c.id === remembered) ? remembered : usable.find((c) => c.identifier === credentialSpec.identifier)?.id ?? "");
      })
      .catch(() => !cancelled && setCredentials([]));
    return () => {
      cancelled = true;
    };
  }, [credentialSpec, storageKey]);
  const chooseCredential = (id) => {
    setCredentialId(id);
    try {
      localStorage.setItem(storageKey, id);
    } catch {
      /* remembering the choice is optional */
    }
  };
  const needsAccount = Boolean(tool.requires_connection) && !toolkit?.no_auth;
  const connected = !needsAccount || accounts.length > 0;

  const run = async (kind) => {
    const { args, problems } = buildArguments(fields, values);
    setAttempted(true);
    setReport(null);
    setResult(null);
    setFailure(null);
    if (problems.length) {
      setFailure({ message: problems.join("; "), code: "validation_error" });
      return;
    }
    if (kind === "run") {
      const ok = await confirm({
        title: `Run ${tool.name}?`,
        message: "This runs the tool for real with your connected account and may change data in the connected app.",
        confirmText: "Run tool",
      });
      if (!ok) return;
    }
    setBusy(kind);
    try {
      if (kind === "dry") setReport(await testTool(tool.id, args, accountId, { credentialId }));
      else setResult(await executeTool(tool.id, args, accountId, credentialId));
    } catch (e) {
      setFailure({
        message: e.message,
        code: e.code,
        candidates: e.details?.candidates ?? [],
        retryAfter: e.retryAfter,
      });
    } finally {
      setBusy(null);
    }
  };

  const [rawView, setRawView] = useState(false);
  const formatted = isDocumentOutput(result?.data);
  const output = result?.data === undefined ? "" : JSON.stringify(result.data, null, 2) ?? "";
  const copy = (text) => navigator.clipboard?.writeText(text).catch(() => {});

  const renderField = ([name, definition]) => (
    <Field
      key={name}
      name={name}
      definition={definition}
      required={required.has(name)}
      invalid={attempted && required.has(name) && isEmpty(name)}
      value={values[name]}
      onChange={(value) => setValues((current) => ({ ...current, [name]: value }))}
      styles={styles}
    />
  );

  return (
    <section aria-label={`Run ${tool.name}`} className="flex min-h-0 flex-1 flex-col">
      <header className={`flex shrink-0 items-start justify-between gap-3 border-b px-5 pb-3 pt-4 ${styles.line}`}>
        <div className="flex min-w-0 items-center gap-3">
          <ToolkitLogo toolkit={toolkit} isLight={isLight} />
          <div className="min-w-0">
            <h2 className="m-0 truncate text-[16px] font-semibold leading-tight">{tool.name}</h2>
            <p className={`m-0 mt-0.5 flex min-w-0 items-center gap-1.5 text-[12px] ${styles.muted}`}>
              <span className="shrink-0">{toolkit?.name}</span>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => copy(tool.slug)}
                title="Copy tool slug"
                className={`min-w-0 cursor-pointer truncate border-0 bg-transparent p-0 text-left ${styles.mono} ${styles.muted} hover:text-(--accent-readable)`}
              >
                {tool.slug}
              </button>
            </p>
          </div>
        </div>
        <button type="button" className={styles.button} onClick={onClose} aria-label="Close">✕</button>
      </header>

      {loaded.error && ready ? (
        <div className="px-5 py-4"><p className={styles.error}>{loaded.error}</p></div>
      ) : !ready ? (
        <div className="px-5 py-4"><Skeleton isLight={isLight} className="h-32 w-full" /></div>
      ) : (
        <div className="scrollable flex min-h-0 flex-1 flex-col overflow-y-auto">
          {/* Left: what to run it with */}
          <div className="flex flex-col gap-4 px-5 py-4">
            {tool.description && <p className={`m-0 text-[13px] leading-relaxed ${styles.body}`}>{tool.description}</p>}

            {needsAccount && (
              <div className={`border p-3 ${styles.divider}`}>
                {accounts.length === 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="m-0 text-[13px]">Connect a {toolkit?.name ?? "matching"} account to use this tool.</p>
                    <button type="button" className={styles.primary} onClick={() => onConnect(toolkit)}>Connect account</button>
                  </div>
                ) : (
                  <label className="flex flex-col gap-1">
                    <span className={`${styles.label} ${styles.muted}`}>Account</span>
                    <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={`${styles.input} py-1.5 sm:text-xs`}>
                      <option value="">Automatic{accounts.length > 1 ? " (you will be asked to choose)" : ""}</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>{account.alias || `Account ${account.id.slice(-6)}`}</option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
            )}

            {credentialSpec && (
              <div className={`border p-3 ${styles.divider}`}>
                <label className="flex flex-col gap-1">
                  <span className={`${styles.label} ${styles.muted}`}>
                    {credentialSpec.label ?? "API key"} {credentialSpec.required ? "" : "· optional"}
                  </span>
                  <select
                    value={credentialId}
                    onChange={(e) => chooseCredential(e.target.value)}
                    disabled={credentials === null}
                    className={`${styles.input} py-1.5 sm:text-xs`}
                  >
                    <option value="">{credentials === null ? "Loading credentials…" : "None (use the server default, if any)"}</option>
                    {(credentials ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}{c.provider ? ` · ${c.provider}` : ""}{c.identifier === credentialSpec.identifier ? "" : ` · ${c.identifier ? c.identifier.replace(/_/g, " ").toLowerCase() : "api key"}`}
                      </option>
                    ))}
                  </select>
                </label>
                <p className={`m-0 mt-1.5 text-[11.5px] ${styles.muted}`}>
                  {credentials && credentials.length === 0 ? "No API key credentials yet. " : "Saved keys come from the Credentials page. "}
                  <a href="/credentials" className={styles.link}>{credentials && credentials.length === 0 ? "Add one" : "Manage credentials"}</a>
                </p>
              </div>
            )}

            {fields.length === 0 ? (
              <p className={`m-0 text-[13px] ${styles.muted}`}>This tool takes no inputs.</p>
            ) : (
              <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); run("dry"); }}>
                {requiredFields.length > 0 && (
                  <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
                    <legend className={`${styles.label} ${styles.muted} mb-2 p-0`}>Required · {requiredFields.length}</legend>
                    {requiredFields.map(renderField)}
                  </fieldset>
                )}
                {optionalFields.length > 0 && (
                  <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
                    <legend className={`${styles.label} ${styles.muted} mb-2 flex w-full items-center justify-between p-0`}>
                      <span>Optional · {optionalFields.length}</span>
                      {requiredFields.length > 0 && optionalFields.length > 3 && (
                        <button type="button" className={styles.link} onClick={() => setShowOptional((open) => !open)}>
                          {optionalOpen ? "Hide" : "Show"}
                        </button>
                      )}
                    </legend>
                    {optionalOpen && optionalFields.map(renderField)}
                  </fieldset>
                )}
              </form>
            )}
          </div>

          {/* Right: what happened */}
          <div className={`flex flex-1 flex-col gap-4 border-t px-5 py-4 ${styles.line} ${isLight ? "bg-white" : styles.raised}`} aria-live="polite">
            <p className={`m-0 ${styles.label} ${styles.muted}`}>Result</p>

            {!failure && !report && !result && (
              <p className={`m-0 text-[13px] leading-relaxed ${styles.muted}`}>
                Fill in the fields, then choose <strong>Dry run</strong> to check everything without running the tool, or <strong>Run tool</strong> to run it. The outcome appears here.
              </p>
            )}

            {failure && (
              <div className={styles.error} role="alert">
                <p className="m-0">{failure.message}</p>
                {failure.code === "connection_required" && (
                  <button type="button" className={`${styles.primary} mt-2`} onClick={() => onConnect(toolkit)}>Connect account</button>
                )}
                {failure.code === "ambiguous_connection" && failure.candidates?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {failure.candidates.map((candidate) => (
                      <button key={candidate.id} type="button" className={styles.button} onClick={() => { setAccountId(candidate.id); setFailure(null); }}>
                        Use {candidate.alias || candidate.id.slice(-6)}
                      </button>
                    ))}
                  </div>
                )}
                {failure.retryAfter ? <p className="m-0 mt-1 text-xs">Try again in {failure.retryAfter}s.</p> : null}
              </div>
            )}

            {report && (
              <div aria-label="Dry run result">
                <p className="m-0 mb-2 flex items-center gap-2 text-sm font-medium">
                  <Chip className={report.passed ? STATUS_TONES.ACTIVE : STATUS_TONES.FAILED}>{report.passed ? "Ready to run" : "Not ready"}</Chip>
                  <span className={`text-xs font-normal ${styles.muted}`}>Dry run, nothing was executed</span>
                </p>
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {report.checks.map((check) => (
                    <li key={check.name} className="text-xs">
                      <span className={`mr-2 font-bold ${CHECK_TONE[check.status]}`}>{CHECK_MARK[check.status]}</span>
                      <span className="font-mono">{check.name}</span>
                      <span className={`ml-2 ${styles.muted}`}>{check.message}</span>
                      {check.details?.errors?.map((line) => (
                        <p key={line} className="m-0 ml-6 text-rose-400">{line}</p>
                      ))}
                      {check.details?.candidates?.length > 0 && (
                        <p className="m-0 ml-6">
                          {check.details.candidates.map((candidate) => (
                            <button key={candidate.id} type="button" className={`${styles.button} mr-1 mt-1`} onClick={() => setAccountId(candidate.id)}>
                              Use {candidate.alias || candidate.id.slice(-6)}
                            </button>
                          ))}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result && (
              <div aria-label="Run result">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 flex items-center gap-2 text-sm font-medium">
                    <Chip className={result.success ? STATUS_TONES.ACTIVE : STATUS_TONES.FAILED}>{result.success ? "Succeeded" : "Failed"}</Chip>
                    <span className={`text-xs font-normal ${styles.muted}`}>
                      {result.metadata?.latency_ms != null ? `${result.metadata.latency_ms} ms` : ""}
                      {result.metadata?.connected_account_id ? ` · account …${result.metadata.connected_account_id.slice(-6)}` : ""}
                    </span>
                  </p>
                  <div className="flex gap-2">
                    {formatted && <button type="button" className={styles.button} onClick={() => setRawView((v) => !v)}>{rawView ? "Formatted" : "Raw JSON"}</button>}
                    {output && <button type="button" className={styles.button} onClick={() => copy(output)}>Copy output</button>}
                  </div>
                </div>
                {result.error && <p className="m-0 mb-2 text-xs text-rose-400">{result.error.message}</p>}
                {formatted && !rawView && <DocumentResults data={result.data} styles={styles} isLight={isLight} />}
                {output && (!formatted || rawView) && (
                  <pre className={`m-0 max-h-96 overflow-auto border p-3 ${styles.mono} ${styles.divider} ${isLight ? "bg-white" : "bg-black"}`}>
                    {output.length > MAX_OUTPUT_CHARS ? `${output.slice(0, MAX_OUTPUT_CHARS)}\n… output truncated` : output}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions stay visible while the fields scroll */}
      <footer className={`flex shrink-0 flex-wrap items-center gap-2 border-t px-5 py-3 ${styles.line}`}>
        <button type="button" className={styles.button} disabled={busy !== null || !ready} onClick={() => run("dry")}>
          {busy === "dry" ? "Checking…" : "Dry run"}
        </button>
        <button type="button" className={styles.primary} disabled={busy !== null || !ready || !connected} onClick={() => run("run")}>
          {busy === "run" ? "Running…" : "Run tool"}
        </button>
        <span className={`text-[11.5px] ${styles.muted}`}>A dry run checks everything without running the tool.</span>
      </footer>
    </section>
  );
}
