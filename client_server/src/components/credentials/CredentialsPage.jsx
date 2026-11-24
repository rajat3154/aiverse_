import { useEffect, useRef, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { createCredential, deleteCredential, listCredentials, updateCredential } from "../../services/credentialService";

const CREDENTIAL_TYPES = [
  { value: "PASSWORD", label: "Password" },
  { value: "API_KEY", label: "API Key" },
  { value: "ACCESS_TOKEN", label: "Access Token" },
  { value: "REFRESH_TOKEN", label: "Refresh Token" },
  { value: "OAUTH_SECRET", label: "OAuth Secret" },
  { value: "DATABASE_CREDENTIAL", label: "Database Credential" },
  { value: "SERVICE_SECRET", label: "Service Secret" },
  { value: "WEBHOOK_SECRET", label: "Webhook Secret" },
  { value: "GENERIC_SECRET", label: "Generic Secret" },
];

const CREDENTIAL_STATUSES = ["ACTIVE", "INACTIVE", "REVOKED"];

// Must match the CredentialIdentifier enum in the spring server.
const CREDENTIAL_IDENTIFIERS = [
  "GROQ_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "OPENROUTER_API_KEY",
  "NVIDIA_NIM_API_KEY",
  "COHERE_API_KEY",
  "MISTRAL_API_KEY",
  "DEEPSEEK_API_KEY",
  "TOGETHER_AI_API_KEY",
  "PERPLEXITY_API_KEY",
  "XAI_API_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "GITLAB_CLIENT_ID",
  "GITLAB_CLIENT_SECRET",
  "MICROSOFT_CLIENT_ID",
  "MICROSOFT_CLIENT_SECRET",
  "SMTP_USERNAME",
  "SMTP_PASSWORD",
  "POSTGRESQL_USERNAME",
  "POSTGRESQL_PASSWORD",
  "MYSQL_USERNAME",
  "MYSQL_PASSWORD",
  "WEBHOOK_SECRET",
  "ACCESS_TOKEN",
  "REFRESH_TOKEN",
  "SERVICE_TOKEN",
  "GENERIC_SECRET",
  "SARVAM_API_KEY",
  "YOUTUBE_API_KEY",
  "LANGSMITH_API_KEY",
  "LANGFUSE_PUBLIC_KEY",
  "LANGFUSE_SECRET_KEY",
  "ARIZE_PHOENIX_API_KEY",
  "NOVEUM_API_KEY",
];

const EMPTY_FORM = { name: "", type: "API_KEY", provider: "", identifier: "", secret: "" };

function humanize(value) {
  return value ? value.replace(/_/g, " ") : value;
}

const KeyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="7.5" cy="15.5" r="5.5" /><path d="M21 2l-9.6 9.6M15.5 7.5L18 10l3-3M21 2l-4 4" />
  </svg>
);
const CheckCircleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);
const BanIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);
const ClockIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const InboxIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
  </svg>
);
const EditIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);
const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
    <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
  </svg>
);
const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 6L6 18M6 6l12 12" /></svg>
);

const KebabIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="12" cy="19" r="1.3" />
  </svg>
);

const TONES = {
  green: "text-emerald-500 bg-emerald-500/12",
  red: "text-red-500 bg-red-500/12",
  orange: "text-orange-500 bg-orange-500/12",
  blue: "text-blue-500 bg-blue-500/12",
  teal: "text-teal-500 bg-teal-500/12",
  neutral: "text-gray-500 bg-gray-500/10",
};

// White mode: solid coloured badges with white text, so they stay clearly visible on a white page.
const SOLID_TONES = {
  green: "bg-emerald-600 text-white",
  red: "bg-red-600 text-white",
  orange: "bg-orange-600 text-white",
  blue: "bg-blue-600 text-white",
  teal: "bg-teal-600 text-white",
  neutral: "bg-gray-600 text-white",
};

function Badge({ tone = "neutral", isLight, children }) {
  const colour = isLight ? SOLID_TONES[tone] : tone === "neutral" ? "text-[#B4C0CE] bg-white/10" : TONES[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${colour}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

// Muted italic placeholder for a value that is not set (same as the Users table).
function Empty({ isLight, children = "Not set" }) {
  return <span className={`italic ${isLight ? "text-gray-500" : "text-[#8EA0B5]"}`}>{children}</span>;
}

function StatCard({ label, value, icon, tint, isLight }) {
  return (
    <div className={`flex-1 min-w-35 flex items-center gap-3 px-4 py-3.5 border ${isLight ? "bg-white border-black/8" : "bg-black border-white/10"}`}>
      <div className="w-9 h-9 flex items-center justify-center shrink-0" style={{ background: tint.bg, color: tint.fg }}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className={`text-[10.5px] uppercase tracking-wider font-semibold leading-tight ${isLight ? "text-gray-500" : "text-[#566273]"}`}>{label}</div>
        <div className={`text-lg font-bold leading-tight ${isLight ? "text-gray-900" : "text-white"}`}>{value}</div>
      </div>

    </div>
  );
}

function FieldLabel({ children, isLight }) {
  return <span className={`text-[12px] font-medium ${isLight ? "text-gray-600" : "text-[#8B98A8]"}`}>{children}</span>;
}

function EmptyState({ title, subtitle, isLight }) {
  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-16 border border-dashed ${isLight ? "border-black/10" : "border-white/10"}`}>
      <div className={isLight ? "text-gray-300" : "text-[#3A4655]"}><InboxIcon /></div>
      <div className="text-center">
        <div className={`text-sm font-medium ${isLight ? "text-gray-700" : "text-[#B8C4D0]"}`}>{title}</div>
        {subtitle && <div className={`text-[12px] mt-0.5 ${isLight ? "text-gray-400" : "text-[#566273]"}`}>{subtitle}</div>}
      </div>
    </div>
  );
}

function ModalShell({ isLight, onClose, title, subtitle, children, maxWidth = "max-w-lg" }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 py-8 overflow-y-auto" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${maxWidth} border shadow-2xl my-auto overflow-hidden ${isLight ? "bg-white border-black/10" : "bg-black border-white/10"}`}
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-1">
            <h2 className={`text-base font-bold uppercase tracking-wide ${isLight ? "text-gray-900" : "text-white"}`}>{title}</h2>
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
          {subtitle && <p className={`text-[12px] mb-5 ${isLight ? "text-gray-500" : "text-[#566273]"}`}>{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}

function CredentialFormModal({ isLight, editing, initial, onCancel, onSubmit }) {
  const [form, setForm] = useState(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const firstInputRef = useRef(null);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  const update = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const inputClass = `w-full px-3.5 py-2.5 text-sm border outline-none transition-colors ${
    isLight ? "bg-white border-black/10 text-gray-900 focus:border-black/25 [color-scheme:light]" : "bg-black border-white/10 text-white focus:border-white/25 [color-scheme:dark]"
  }`;

  // The open list is drawn by the browser, so give every option its own background and text colour to keep it readable.
  const optionClass = isLight ? "bg-white text-gray-900" : "bg-black text-white";

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
      setSubmitting(false); // on success the modal closes, so there is nothing left to re-enable
    }
  };

  return (
    <ModalShell
      isLight={isLight}
      onClose={onCancel}
      maxWidth="max-w-lg"
      title={editing ? "Edit credential" : "New credential"}
      subtitle={editing ? "Update credential details, or rotate the secret." : "The secret is encrypted at rest and never shown again."}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <FieldLabel isLight={isLight}>Name</FieldLabel>
          <input ref={firstInputRef} required value={form.name} onChange={update("name")} className={inputClass} maxLength={150} placeholder="OpenAI production key" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          {!editing ? (
            <label className="flex flex-col gap-1.5">
              <FieldLabel isLight={isLight}>Type</FieldLabel>
              <select value={form.type} onChange={update("type")} className={`${inputClass} cursor-pointer`}>
                {CREDENTIAL_TYPES.map((t) => (
                  <option className={optionClass} key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="flex flex-col gap-1.5">
              <FieldLabel isLight={isLight}>Status</FieldLabel>
              <select value={form.status} onChange={update("status")} className={`${inputClass} cursor-pointer`}>
                {CREDENTIAL_STATUSES.map((s) => (
                  <option className={optionClass} key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1.5">
            <FieldLabel isLight={isLight}>Provider</FieldLabel>
            <input value={form.provider} onChange={update("provider")} className={inputClass} placeholder="OpenAI, AWS, Stripe…" maxLength={100} />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <FieldLabel isLight={isLight}>Identifier</FieldLabel>
          <select value={form.identifier} onChange={update("identifier")} className={`${inputClass} cursor-pointer`}>
            <option className={optionClass} value="">Select…</option>
            {CREDENTIAL_IDENTIFIERS.map((id) => (
              <option className={optionClass} key={id} value={id}>{humanize(id)}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <FieldLabel isLight={isLight}>{editing ? "New secret (leave blank to keep current)" : "Secret"}</FieldLabel>
          <input
            type="password"
            value={form.secret}
            onChange={update("secret")}
            required={!editing}
            maxLength={8192}
            autoComplete="new-password"
            className={inputClass}
            placeholder={editing ? "••••••••" : "Paste the secret value"}
          />
        </label>

        {error && (
          <div role="alert" className="px-3.5 py-2.5 text-[13px]" style={{ background: "rgba(251,113,133,0.1)", color: "#FB7185" }}>
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 mt-1">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 px-4 py-2.5 text-sm font-bold uppercase tracking-wide cursor-pointer border-0 text-[#070A0F] transition-transform hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60"
            style={{ background: "var(--accent-paint)", boxShadow: "0 8px 24px -8px var(--accent-soft)" }}
          >
            {submitting ? "Saving…" : editing ? "Save changes" : "Create credential"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className={`px-4 py-2.5 text-sm font-semibold uppercase tracking-wide cursor-pointer border transition-colors disabled:opacity-60 ${
              isLight ? "border-black/10 text-gray-700 hover:bg-black/4" : "border-white/10 text-[#B8C4D0] hover:bg-white/5"
            }`}
          >
            Cancel
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// Three-dot actions menu for small screens. Positioned with fixed coordinates so the table's scroll area cannot clip it.
function RowMenu({ isLight, label, items, busy }) {
  const [pos, setPos] = useState(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!pos) return undefined;
    const close = () => setPos(null);
    const onKey = (e) => e.key === "Escape" && close();
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    document.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  const toggle = (ev) => {
    ev.stopPropagation();
    if (pos) return setPos(null);
    const rect = buttonRef.current.getBoundingClientRect();
    const right = window.innerWidth - rect.right;
    const menuHeight = items.length * 40 + 8;
    setPos(rect.bottom + menuHeight + 8 > window.innerHeight ? { bottom: window.innerHeight - rect.top + 4, right } : { top: rect.bottom + 4, right });
  };

  return (
    <div className="flex justify-end">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={Boolean(pos)}
        onClick={toggle}
        className={`flex h-8 w-8 cursor-pointer items-center justify-center border-0 bg-transparent transition ${
          isLight ? "text-gray-500 hover:bg-black/5 hover:text-gray-900" : "text-[#AEBBCB] hover:bg-white/8 hover:text-white"
        }`}
      >
        <KebabIcon />
      </button>
      {pos && (
        <div
          role="menu"
          style={pos}
          className={`fixed z-50 w-44 border py-1 shadow-2xl ${isLight ? "border-[#E5E4E7] bg-white text-gray-900" : "border-[#2A3649] bg-black text-white"}`}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={item.onClick}
              className={`flex w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent px-3.5 py-2.5 text-left text-sm transition disabled:opacity-40 ${
                item.danger ? "text-red-500" : ""
              } ${isLight ? "hover:bg-black/5" : "hover:bg-white/8"}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const COLUMNS = ["Name", "Type", "Provider", "Identifier", "Status", "Last used", "Created"];

const fmtDate = (value) => (value ? new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null);

function CredentialRow({ credential, isLight, busy, onEdit, onDelete }) {
  const line = isLight ? "border-black/8" : "border-white/12";
  const cell = isLight ? "text-gray-700" : "text-[#DCE4EE]";
  const statusTone = credential.status === "ACTIVE" ? "green" : credential.status === "REVOKED" ? "red" : "orange";
  const iconBtn = `flex h-8 w-8 cursor-pointer items-center justify-center border-0 bg-transparent transition disabled:cursor-not-allowed disabled:opacity-40 ${
    isLight ? "text-gray-500 hover:bg-black/5 hover:text-gray-900" : "text-[#AEBBCB] hover:bg-white/8 hover:text-white"
  }`;

  return (
    <tr className={`border-b transition-colors last:border-b-0 ${line} ${isLight ? "bg-white hover:bg-gray-50" : "bg-black hover:bg-gray-900"}`}>
      <td className="px-3.5 py-3.5">
        <div className="flex items-center gap-3">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isLight ? "bg-black/5 text-gray-500" : "bg-white/8 text-[#AEBBCB]"}`}>
            <KeyIcon />
          </span>
          <span className="max-w-56 truncate font-medium" title={credential.name}>{credential.name}</span>
        </div>
      </td>
      <td className="px-3.5 py-3.5"><Badge tone="blue" isLight={isLight}>{humanize(credential.type)}</Badge></td>
      <td className={`px-3.5 py-3.5 whitespace-nowrap ${cell}`}>{credential.provider || <Empty isLight={isLight} />}</td>
      <td className={`px-3.5 py-3.5 whitespace-nowrap ${cell}`}>
        {credential.identifier ? <Badge tone="teal" isLight={isLight}>{humanize(credential.identifier)}</Badge> : <Empty isLight={isLight} />}
      </td>
      <td className="px-3.5 py-3.5"><Badge tone={statusTone} isLight={isLight}>{humanize(credential.status)}</Badge></td>
      <td className={`px-3.5 py-3.5 text-xs whitespace-nowrap ${cell}`}>{fmtDate(credential.lastUsedAt) || <Empty isLight={isLight}>Never</Empty>}</td>
      <td className={`px-3.5 py-3.5 text-xs whitespace-nowrap ${cell}`}>{fmtDate(credential.createdAt)}</td>
      <td className="sticky right-0 z-10 bg-inherit px-3.5 py-2">
        {/* Desktop: the buttons side by side */}
        <div className="hidden items-center justify-end gap-1 md:flex">
          <button type="button" aria-label={`Edit ${credential.name}`} title="Edit" className={iconBtn} onClick={onEdit}><EditIcon /></button>
          <button type="button" aria-label={`Delete ${credential.name}`} title="Delete" className={`${iconBtn} hover:text-red-400!`} disabled={busy} onClick={onDelete}><TrashIcon /></button>
        </div>
        {/* Mobile and smaller screens: the same actions in a three-dot menu */}
        <div className="md:hidden">
          <RowMenu
            isLight={isLight}
            busy={busy}
            label={`Actions for ${credential.name}`}
            items={[
              { label: "Edit", icon: <EditIcon />, onClick: onEdit },
              { label: "Delete", icon: <TrashIcon />, danger: true, onClick: onDelete },
            ]}
          />
        </div>
      </td>
    </tr>
  );
}

export default function CredentialsPage() {
  const { mainSectionTheme } = useTheme();
  const isLight = mainSectionTheme === "light";

  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [search, setSearch] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [deleting, setDeleting] = useState(null);

  // The gateway identifies the signed-in user from the access token, so this only ever returns their own credentials.
  useEffect(() => {
    listCredentials()
      .then(setCredentials)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const flashSuccess = (message) => {
    setSuccess(message);
    setError(null);
    setTimeout(() => setSuccess((s) => (s === message ? null : s)), 3000);
  };

  const handleCreate = async (form) => {
    const saved = await createCredential({
      name: form.name.trim(),
      type: form.type,
      provider: form.provider.trim() || null,
      identifier: form.identifier || null,
      secret: form.secret,
    });
    setCredentials((list) => [saved, ...list]);
    setShowCreateModal(false);
    flashSuccess("Credential created.");
  };

  const handleEdit = async (form) => {
    const saved = await updateCredential(editTarget.id, {
      name: form.name.trim(),
      provider: form.provider.trim() || null,
      identifier: form.identifier || null,
      secret: form.secret || null,
      status: form.status,
      metadata: editTarget.metadata ?? null, // this page does not edit metadata, so keep what is stored
    });
    setCredentials((list) => list.map((c) => (c.id === saved.id ? saved : c)));
    setEditTarget(null);
    flashSuccess("Credential updated.");
  };

  const confirmDelete = async () => {
    const target = deleting;
    setBusyId(target.id);
    setError(null);
    try {
      await deleteCredential(target.id);
      setCredentials((list) => list.filter((c) => c.id !== target.id));
      flashSuccess("Credential deleted.");
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(null);
      setBusyId(null);
    }
  };

  const filteredCredentials = credentials.filter((c) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.provider?.toLowerCase().includes(q) ||
      c.identifier?.toLowerCase().includes(q) ||
      c.type?.toLowerCase().includes(q)
    );
  });

  const stats = {
    total: credentials.length,
    active: credentials.filter((c) => c.status === "ACTIVE").length,
    revoked: credentials.filter((c) => c.status === "REVOKED").length,
    unused: credentials.filter((c) => !c.lastUsedAt).length,
  };

  if (loading) {
    return (
      <div className={`flex-1 min-w-0 flex items-center justify-center h-full ${isLight ? "bg-white text-gray-500" : "bg-black text-[#566273]"}`}>
        Loading credentials…
      </div>
    );
  }

  return (
    <div className={`flex-1 min-w-0 flex flex-col h-full overflow-y-auto scrollable ${isLight ? "bg-white text-gray-900" : "bg-black text-white"}`}>
      <div className="w-full px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6">
          <div>
            <p className="text-xs font-medium tracking-widest text-(--accent-readable)">ENCRYPTED AT REST</p>
            <h1 className="mt-1 text-2xl font-bold">Credentials</h1>
            <p className={`mt-1 text-sm ${isLight ? "text-gray-600" : "text-[#AEBBCB]"}`}>
              Store the API keys, tokens and passwords your agents and workflows use. Only you can see and manage yours.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="flex w-full cursor-pointer items-center justify-center gap-2 border-0 px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 sm:w-auto"
            style={{ backgroundImage: "var(--accent-paint)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
            New credential
          </button>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <StatCard label="Total" value={stats.total} icon={<KeyIcon />} tint={{ bg: "color-mix(in srgb, var(--accent-color) 15%, transparent)", fg: "var(--accent-color)" }} isLight={isLight} />
          <StatCard label="Active" value={stats.active} icon={<CheckCircleIcon />} tint={{ bg: "rgba(52,211,153,0.12)", fg: "#34D399" }} isLight={isLight} />
          <StatCard label="Revoked" value={stats.revoked} icon={<BanIcon />} tint={{ bg: "rgba(251,113,133,0.12)", fg: "#FB7185" }} isLight={isLight} />
          <StatCard label="Never used" value={stats.unused} icon={<ClockIcon />} tint={{ bg: "rgba(251,191,36,0.12)", fg: "#FBBF24" }} isLight={isLight} />
        </div>

        {(error || success) && (
          <div
            role={error ? "alert" : "status"}
            className="mb-6 px-3.5 py-2.5 text-[13px]"
            style={error ? { background: "rgba(251,113,133,0.1)", color: "#FB7185" } : { background: "rgba(52,211,153,0.1)", color: "#34D399" }}
          >
            {error || success}
          </div>
        )}

        <div className="flex items-center gap-2.5 mb-4">
          <div className={`flex-1 flex items-center gap-2 px-3 py-2 border ${isLight ? "bg-white border-black/10" : "bg-black border-white/10"}`}>
            <span className={isLight ? "text-gray-400" : "text-[#566273]"}><SearchIcon /></span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search credentials"
              placeholder="Search by name, provider, or identifier…"
              className={`flex-1 bg-transparent border-0 outline-none text-sm ${isLight ? "text-gray-900 placeholder:text-gray-400" : "text-white placeholder:text-[#8B98A8]"}`}
            />
          </div>
        </div>

        {filteredCredentials.length === 0 ? (
          <EmptyState
            title={credentials.length === 0 ? "No credentials yet" : "No credentials match your search"}
            subtitle={credentials.length === 0 ? "Add one to get started." : "Try a different search term."}
            isLight={isLight}
          />
        ) : (
          <div className={`scrollable mt-4 overflow-x-auto ${isLight ? "bg-white" : "bg-black"}`}>
            <table className="w-full min-w-205 border-collapse text-left text-[13px]">
              <thead className={`text-[10.5px] tracking-widest whitespace-nowrap uppercase ${isLight ? "text-gray-500" : "text-[#C3CEDB]"}`}>
                <tr className={`border-b ${isLight ? "border-black/8 bg-white" : "border-white/12 bg-black"}`}>
                  {COLUMNS.map((c) => (
                    <th key={c} className="px-3.5 py-3 font-medium">{c}</th>
                  ))}
                  <th className={`sticky right-0 z-10 px-3.5 py-3 ${isLight ? "bg-white" : "bg-black"}`} />
                </tr>
              </thead>
              <tbody>
                {filteredCredentials.map((credential) => (
                  <CredentialRow
                    key={credential.id}
                    credential={credential}
                    isLight={isLight}
                    busy={busyId === credential.id}
                    onEdit={() => setEditTarget(credential)}
                    onDelete={() => setDeleting(credential)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CredentialFormModal
          isLight={isLight}
          editing={false}
          initial={EMPTY_FORM}
          onCancel={() => setShowCreateModal(false)}
          onSubmit={handleCreate}
        />
      )}

      {editTarget && (
        <CredentialFormModal
          isLight={isLight}
          editing
          initial={{
            name: editTarget.name ?? "",
            provider: editTarget.provider ?? "",
            identifier: editTarget.identifier ?? "",
            secret: "",
            status: editTarget.status ?? "ACTIVE",
          }}
          onCancel={() => setEditTarget(null)}
          onSubmit={handleEdit}
        />
      )}

      {deleting && (
        <ModalShell isLight={isLight} onClose={() => setDeleting(null)} title="Delete credential" maxWidth="max-w-md">
          <p className={`text-sm ${isLight ? "text-gray-600" : "text-[#AEBBCB]"}`}>
            Permanently delete <strong className={isLight ? "text-gray-900" : "text-white"}>{deleting.name}</strong>? Anything that uses it will stop working. This cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-5">
            <button
              type="button"
              onClick={() => setDeleting(null)}
              className={`cursor-pointer border bg-transparent px-4 py-2 text-sm transition hover:opacity-80 ${isLight ? "border-black/10 text-gray-700" : "border-white/10 text-[#B8C4D0]"}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={busyId === deleting.id}
              className="cursor-pointer border-0 bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-60"
            >
              {busyId === deleting.id ? "Deleting…" : "Delete"}
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
