import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { createUser, deleteUser, listUsers, updateUser } from "../../services/userService";
import { Field } from "../auth/AuthFields";
import { inputClass } from "../auth/inputClass";

const ROLES = ["USER", "ADMIN"];
const EMPTY_FORM = {
  firstName: "", lastName: "", email: "", username: "", password: "", phoneNumber: "", role: "USER",
  dateOfBirth: "", gender: "", location: "", website: "", bio: "", status: "active",
};
const GENDERS = ["MALE", "FEMALE", "OTHER"];
const FILTERS = [
  { id: "all", label: "All", match: () => true },
  { id: "active", label: "Active", match: (u) => u.enabled },
  { id: "inactive", label: "Inactive", match: (u) => !u.enabled },
  { id: "admins", label: "Admins", match: (u) => u.role !== "USER" },
];

// Mirrors the validation rules of CreateUserRequest / UpdateUserRequest on the spring server.
const validate = (v, creating) => {
  const e = {};
  if (!v.firstName.trim()) e.firstName = "First name is required";
  if (!v.lastName.trim()) e.lastName = "Last name is required";
  if (!/^\S+@\S+\.\S+$/.test(v.email.trim())) e.email = "Enter a valid email address";
  if (!/^[a-zA-Z0-9_.]{3,50}$/.test(v.username.trim())) e.username = "3-50 characters: letters, numbers, _ and .";
  if (creating && (v.password.length < 8 || v.password.length > 100)) e.password = "Password must be 8-100 characters";
  if (v.phoneNumber.trim() && !/^[+]?[0-9]{10,15}$/.test(v.phoneNumber.trim())) e.phoneNumber = "Invalid phone number";
  if (v.location.length > 150) e.location = "Location must not exceed 150 characters";
  if (v.website.trim() && !/^https?:\/\/.+/.test(v.website.trim())) e.website = "Must start with http:// or https://";
  if (v.bio.length > 500) e.bio = "Bio must not exceed 500 characters";
  return e;
};

const Svg = ({ children, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
const PlusIcon = () => <Svg><path d="M12 5v14M5 12h14" /></Svg>;
const SearchIcon = () => <Svg><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.35-4.35" /></Svg>;
const EditIcon = () => <Svg size={15}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></Svg>;
const TrashIcon = () => <Svg size={15}><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" /></Svg>;
const KebabIcon = () => <Svg size={16}><circle cx="12" cy="5" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="12" cy="19" r="1.3" /></Svg>;
const ColumnsIcon = () => <Svg size={15}><rect x="3" y="4" width="18" height="16" /><path d="M9 4v16M15 4v16" /></Svg>;
const EyeIcon = () => <Svg size={15}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></Svg>;
const UsersIcon = () => <Svg size={28}><circle cx="9" cy="8" r="3" /><path d="M3 20v-1a5 5 0 0110 0v1" /><path d="M16 5a3 3 0 010 6M18 20v-1a5 5 0 00-3-4.6" /></Svg>;

const COLUMN_DEFS = [
  { key: "dp", label: "DP" },
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "username", label: "Username" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "dob", label: "Date of birth" },
  { key: "gender", label: "Gender" },
  { key: "accountType", label: "Account type" },
  { key: "location", label: "Location" },
  { key: "website", label: "Website" },
  { key: "bio", label: "Bio" },
  { key: "role", label: "Role" },
  { key: "status", label: "Status" },
  { key: "emailVerified", label: "Email verified" },
  { key: "phoneVerified", label: "Phone verified" },
  { key: "created", label: "Created" },
  { key: "updated", label: "Updated" },
];
const HIDDEN_KEY = "aiverse.master.hidden-columns"; // stores what is hidden, so every column shows by default

const fmtDate = (value) => new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
const label = (value) => (value ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, " ") : "Not set");
const NOT_SET = "Not set";
// Muted placeholder for a field the user has not filled in.
const Empty = ({ children = NOT_SET }) => {
  const light = useTheme().mainSectionTheme === "light";
  return <span className={`italic ${light ? "text-gray-500" : "text-[#8EA0B5]"}`}>{children}</span>;
};
const TONES = {
  green: "text-emerald-500 bg-emerald-500/12",
  red: "text-red-500 bg-red-500/12",
  amber: "text-amber-600 bg-amber-500/15",
  orange: "text-orange-500 bg-orange-500/12",
  blue: "text-blue-500 bg-blue-500/12",
  sky: "text-sky-500 bg-sky-500/12",
  violet: "text-violet-500 bg-violet-500/12",
  pink: "text-pink-500 bg-pink-500/12",
  teal: "text-teal-500 bg-teal-500/12",
  neutral: "text-gray-500 bg-gray-500/10",
};
const Badge = ({ tone = "neutral", children }) => {
  const light = useTheme().mainSectionTheme === "light";
  const colour =
    tone === "neutral" && !light ? "text-[#B4C0CE] bg-white/10" : tone === "amber" && !light ? "text-amber-400 bg-amber-500/15" : TONES[tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${colour}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
};
const Verified = ({ ok }) => <Badge tone={ok ? "green" : "orange"}>{ok ? "Verified" : "Not verified"}</Badge>;

const initials = (u) => `${u.firstName?.[0] ?? ""}${u.lastName?.[0] ?? ""}`.toUpperCase() || "?";

// Profile photo (dp) with the initials avatar as a fallback when there is none or it fails to load.
const CrownBadge = ({ className = "" }) => (
  <span className={`flex items-center justify-center rounded-full bg-amber-400 text-black shadow ${className}`} title="Premium">
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M2 19l2-11 5 5 3-8 3 8 5-5 2 11z" />
    </svg>
  </span>
);

// `premium` (the master account) gets a gold ring and a crown instead of a text label.
const Avatar = ({ user, premium }) => {
  const [failed, setFailed] = useState(false);
  const photo =
    user.profilePhoto && !failed ? (
      <img src={user.profilePhoto} alt="" onError={() => setFailed(true)} className="h-8 w-8 shrink-0 rounded-full object-cover" />
    ) : (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-black" style={{ backgroundImage: "var(--accent-paint)" }}>
        {initials(user)}
      </span>
    );
  if (!premium) return photo;
  return (
    <span className="relative inline-flex shrink-0 rounded-full bg-linear-to-br from-amber-200 via-yellow-400 to-orange-500 p-0.5 shadow-[0_0_10px_rgba(251,191,36,0.45)]">
      {photo}
      <CrownBadge className="absolute -top-1.5 -right-1.5 h-4 w-4" />
    </span>
  );
};

// Read-only status; changing it happens in the Edit form.
const StatusBadge = ({ user }) => <Badge tone={user.enabled ? "green" : "red"}>{user.enabled ? "Active" : "Inactive"}</Badge>;

const roleTone = (role) => (role === "MASTER" ? "violet" : role === "ADMIN" ? "amber" : "blue");
const genderTone = (gender) => (gender === "MALE" ? "sky" : gender === "FEMALE" ? "pink" : "violet");

// Soft, borderless search field: grows while focused, "/" focuses it, and a clear button appears once there is text.
const SearchBox = ({ light, value, onChange }) => {
  const inputRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName ?? "");
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className={`group relative flex h-10 w-full items-center border transition-all duration-300 focus-within:border-(--accent-color) sm:w-64 sm:focus-within:w-80 lg:w-72 lg:focus-within:w-96 ${
        light ? "border-[#E5E4E7] bg-white" : "border-[#2A3649] bg-black"
      }`}
    >
      <span className={`pointer-events-none pl-3.5 transition-colors group-focus-within:text-(--accent-readable) ${light ? "text-gray-400" : "text-[#7E8DA0]"}`}>
        <SearchIcon />
      </span>
      <input
        ref={inputRef}
        type="text"
        role="searchbox"
        aria-label="Search users"
        placeholder="Search users…"
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        onKeyDown={(ev) => ev.key === "Escape" && (onChange(""), ev.currentTarget.blur())}
        className={`h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-sm outline-none ${light ? "text-gray-900 placeholder:text-gray-400" : "text-white placeholder:text-[#7E8DA0]"}`}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            inputRef.current?.focus();
          }}
          className={`mr-2 flex h-6 w-6 cursor-pointer items-center justify-center border-0 bg-transparent ${light ? "text-gray-500 hover:bg-black/5" : "text-[#AEBBCB] hover:bg-white/10"}`}
        >
          <Svg size={13}><path d="M6 6l12 12M18 6L6 18" /></Svg>
        </button>
      ) : (
        <kbd className={`mr-3 hidden border px-1.5 py-0.5 font-sans text-[10px] sm:block group-focus-within:hidden ${light ? "border-gray-300 text-gray-400" : "border-[#2A3649] text-[#7E8DA0]"}`}>/</kbd>
      )}
    </div>
  );
};

// Three-dot actions menu. The menu is positioned with fixed coordinates so the table's scroll area cannot clip it.
const RowMenu = ({ light, label: ariaLabel, items, busy }) => {
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
    const menuHeight = items.length * 40 + 8;
    const right = window.innerWidth - rect.right;
    // open upwards when there is no room below
    setPos(rect.bottom + menuHeight + 8 > window.innerHeight ? { bottom: window.innerHeight - rect.top + 4, right } : { top: rect.bottom + 4, right });
  };

  const itemClass = (danger) =>
    `flex w-full cursor-pointer items-center gap-2.5 border-0 bg-transparent px-3.5 py-2.5 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
      danger ? "text-red-500" : ""
    } ${light ? "hover:bg-black/5" : "hover:bg-white/8"}`;

  return (
    <div className="flex justify-end">
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={Boolean(pos)}
        onClick={toggle}
        className={`flex h-8 w-8 cursor-pointer items-center justify-center border-0 bg-transparent transition ${
          light ? "text-gray-500 hover:bg-black/5 hover:text-gray-900" : "text-[#AEBBCB] hover:bg-white/8 hover:text-white"
        } ${pos ? (light ? "bg-black/5" : "bg-white/8") : ""}`}
      >
        <KebabIcon />
      </button>
      {pos && (
        <div
          role="menu"
          style={pos}
          className={`fixed z-50 w-44 border py-1 shadow-2xl ${light ? "border-[#E5E4E7] bg-white text-gray-900" : "border-[#2A3649] bg-[#151E2C] text-white"}`}
        >
          {items.map((item) => (
            <button key={item.label} type="button" role="menuitem" disabled={item.disabled || busy} className={itemClass(item.danger)} onClick={item.onClick}>
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// "Columns" dropdown: tick the columns you want in the table. Everything is shown by default.
const ColumnPicker = ({ light, hidden, onToggle, onReset }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const shown = COLUMN_DEFS.length - hidden.length;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !rootRef.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const border = light ? "border-[#E5E4E7]" : "border-[#2A3649]";
  const muted = light ? "text-gray-500" : "text-[#9AA9BB]";

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-10 cursor-pointer items-center gap-2 border px-3.5 text-sm transition ${border} ${light ? "bg-white hover:bg-gray-50" : "bg-black hover:bg-white/5"} ${open ? "border-(--accent-color)" : ""}`}
      >
        <ColumnsIcon />
        <span className="hidden sm:inline">Columns</span>
        <span className={`text-xs ${muted}`}>{shown}/{COLUMN_DEFS.length}</span>
      </button>
      {open && (
        <div className={`absolute top-12 right-0 z-30 w-64 border shadow-2xl ${border} ${light ? "bg-white text-gray-900" : "bg-[#151E2C] text-white"}`}>
          <div className={`flex items-center justify-between border-b px-3.5 py-2.5 ${border}`}>
            <span className={`text-[10px] font-semibold tracking-widest uppercase ${muted}`}>Show columns</span>
            <button
              type="button"
              disabled={hidden.length === 0}
              onClick={onReset}
              className="cursor-pointer border-0 bg-transparent p-0 text-xs text-(--accent-readable) hover:underline disabled:cursor-default disabled:opacity-40 disabled:no-underline"
            >
              Show all
            </button>
          </div>
          <ul className="scrollable max-h-72 overflow-y-auto py-1">
            {COLUMN_DEFS.map((c) => {
              const checked = !hidden.includes(c.key);
              return (
                <li key={c.key}>
                  <label className={`flex cursor-pointer items-center gap-3 px-3.5 py-2 text-sm ${light ? "hover:bg-black/5" : "hover:bg-white/8"}`}>
                    <input type="checkbox" className="h-4 w-4 cursor-pointer accent-(--accent-color)" checked={checked} onChange={() => onToggle(c.key)} />
                    {c.label}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

const Modal = ({ light, title, subtitle, onClose, children }) => {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(ev) => ev.stopPropagation()}
        className={`max-h-[90dvh] w-full max-w-lg overflow-y-auto scrollable border p-6 shadow-2xl ${
          light ? "bg-white border-[#E5E4E7] text-gray-900" : "bg-[#0B0F17] border-[#263241] text-white"
        }`}
      >
        <h2 className="text-lg font-bold">{title}</h2>
        {subtitle && <p className={`mt-1 text-sm ${light ? "text-gray-600" : "text-[#AEBBCB]"}`}>{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
};

// Full profile of one user, as a drawer sliding in from the right so the table stays visible behind it.
const ProfileSection = ({ title, muted, border, children }) => (
  <section className="mt-6">
    <h4 className={`mb-1 text-[10px] font-semibold tracking-widest uppercase ${muted}`}>{title}</h4>
    <dl className={`border-t ${border}`}>{children}</dl>
  </section>
);

const ProfileRow = ({ name, children, muted, border }) => (
  <div className={`flex items-start justify-between gap-6 border-b py-3 text-sm ${border}`}>
    <dt className={`shrink-0 ${muted}`}>{name}</dt>
    <dd className="min-w-0 text-right break-words">{children || <Empty />}</dd>
  </div>
);

const ProfileDrawer = ({ light, user: u, onEdit, onClose }) => {
  const [shown, setShown] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [bannerFailed, setBannerFailed] = useState(false);
  const muted = light ? "text-gray-500" : "text-[#9AA9BB]";
  const border = light ? "border-black/8" : "border-white/12";

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true)); // next frame, so the slide-in transition runs
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const row = { muted, border };

  return (
    <div className="fixed inset-0 z-50">
      <div className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${shown ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="User profile"
        className={`absolute top-0 right-0 flex h-full w-full max-w-md flex-col border-l shadow-2xl transition-transform duration-300 ease-out ${shown ? "translate-x-0" : "translate-x-full"} ${
          light ? "border-[#E5E4E7] bg-white text-gray-900" : "border-[#2A3649] bg-[#0B0F17] text-white"
        }`}
      >
        <div className="relative shrink-0">
          <div className="h-36 overflow-hidden" style={{ backgroundImage: "var(--accent-paint)" }}>
            {u.banner && !bannerFailed && <img src={u.banner} alt="" onError={() => setBannerFailed(true)} className="h-full w-full object-cover" />}
          </div>
          <button
            type="button"
            aria-label="Close profile"
            onClick={onClose}
            className="absolute top-3 right-3 flex h-8 w-8 cursor-pointer items-center justify-center border-0 bg-black/50 text-white transition hover:bg-black/70"
          >
            <Svg size={16}><path d="M6 6l12 12M18 6L6 18" /></Svg>
          </button>
          <div className="absolute -bottom-12 left-6 z-10">
            <div
              className={`flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 text-3xl font-bold text-black ${
                u.role === "MASTER" ? "border-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.5)]" : light ? "border-white" : "border-[#0B0F17]"
              }`}
              style={{ backgroundImage: "var(--accent-paint)" }}
            >
              {u.profilePhoto && !photoFailed ? <img src={u.profilePhoto} alt="" onError={() => setPhotoFailed(true)} className="h-full w-full object-cover" /> : initials(u)}
            </div>
            {u.role === "MASTER" && <CrownBadge className="absolute right-0 bottom-1 h-7 w-7 border-2 border-white" />}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollable px-6 pt-14 pb-6">
          <h3 className="mt-3 text-2xl font-bold">{u.firstName} {u.lastName}</h3>
          <p className={`text-sm ${muted}`}>@{u.username}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge tone={roleTone(u.role)}>{u.role}</Badge>
            <StatusBadge user={u} />
          </div>

          <ProfileSection title="About" {...row}>
            <p className={`py-3 text-sm ${u.bio ? "" : muted}`}>{u.bio || <Empty>No bio yet</Empty>}</p>
          </ProfileSection>

          <ProfileSection title="Contact" {...row}>
            <ProfileRow name="Email" {...row}>{u.email}</ProfileRow>
            <ProfileRow name="Phone" {...row}>{u.phoneNumber}</ProfileRow>
            <ProfileRow name="Location" {...row}>{u.location}</ProfileRow>
            <ProfileRow name="Website" {...row}>
              {u.website && <a href={u.website} target="_blank" rel="noreferrer noopener" className="text-(--accent-readable) hover:underline">{u.website}</a>}
            </ProfileRow>
          </ProfileSection>

          <ProfileSection title="Personal" {...row}>
            <ProfileRow name="Date of birth" {...row}>{u.dateOfBirth && fmtDate(u.dateOfBirth)}</ProfileRow>
            <ProfileRow name="Gender" {...row}>{u.gender && <Badge tone={genderTone(u.gender)}>{label(u.gender)}</Badge>}</ProfileRow>
          </ProfileSection>

          <ProfileSection title="Account" {...row}>
            <ProfileRow name="Account type" {...row}><Badge tone="teal">{u.accountType ? label(u.accountType) : "General user"}</Badge></ProfileRow>
            <ProfileRow name="Email verified" {...row}><Verified ok={u.emailVerified} /></ProfileRow>
            <ProfileRow name="Phone verified" {...row}><Verified ok={u.phoneVerified} /></ProfileRow>
            <ProfileRow name="Created" {...row}>{fmtDate(u.createdAt)}</ProfileRow>
            <ProfileRow name="Updated" {...row}>{fmtDate(u.updatedAt)}</ProfileRow>
          </ProfileSection>
        </div>

        {u.role !== "MASTER" && (
          <div className={`flex shrink-0 justify-end gap-3 border-t px-6 py-3 ${border}`}>
            <button
              type="button"
              onClick={() => onEdit(u)}
              className="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
              style={{ backgroundImage: "var(--accent-paint)" }}
            >
              <EditIcon /> Edit user
            </button>
          </div>
        )}
      </aside>
    </div>
  );
};

const UserForm = ({ light, user, onSaved, onClose }) => {
  const creating = !user;
  const [values, setValues] = useState(
    user
      ? {
          ...EMPTY_FORM,
          firstName: user.firstName, lastName: user.lastName, email: user.email, username: user.username,
          phoneNumber: user.phoneNumber ?? "", role: user.role, dateOfBirth: user.dateOfBirth ?? "", gender: user.gender ?? "",
          location: user.location ?? "", website: user.website ?? "", bio: user.bio ?? "", status: user.enabled ? "active" : "inactive",
        }
      : EMPTY_FORM
  );
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [saving, setSaving] = useState(false);

  const bind = (name) => ({
    name,
    value: values[name],
    onChange: (ev) => {
      setValues((c) => ({ ...c, [name]: ev.target.value }));
      if (errors[name]) setErrors((c) => ({ ...c, [name]: undefined }));
    },
    className: `${inputClass(Boolean(errors[name]), light)}`,
  });

  const onSubmit = async (ev) => {
    ev.preventDefault();
    setServerError("");
    const found = validate(values, creating);
    setErrors(found);
    if (Object.keys(found).length) return;

    const body = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim(),
      username: values.username.trim(),
      role: values.role,
      ...(values.phoneNumber.trim() && { phoneNumber: values.phoneNumber.trim() }),
      ...(creating && { password: values.password }),
      ...(values.dateOfBirth && { dateOfBirth: values.dateOfBirth }),
      ...(values.gender && { gender: values.gender }),
      ...(values.location.trim() && { location: values.location.trim() }),
      ...(values.website.trim() && { website: values.website.trim() }),
      ...(values.bio.trim() && { bio: values.bio.trim() }),
      ...(!creating && { enabled: values.status === "active" }),
    };
    setSaving(true);
    try {
      onSaved(creating ? await createUser(body) : await updateUser(user.tenantId, body), creating);
    } catch (error) {
      setServerError(error.message);
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field light={light} label="First name" error={errors.firstName}><input type="text" autoFocus {...bind("firstName")} /></Field>
        <Field light={light} label="Last name" error={errors.lastName}><input type="text" {...bind("lastName")} /></Field>
      </div>
      <Field light={light} label="Email" error={errors.email}><input type="email" {...bind("email")} /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field light={light} label="Username" error={errors.username}><input type="text" {...bind("username")} /></Field>
        <Field light={light} label="Role">
          <select {...bind("role")}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
        </Field>
      </div>
      {creating && (
        <Field light={light} label="Password" error={errors.password}>
          <input type="password" autoComplete="new-password" placeholder="At least 8 characters" {...bind("password")} />
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field light={light} label="Phone" optional error={errors.phoneNumber}><input type="tel" placeholder="+911234567890" {...bind("phoneNumber")} /></Field>
        {!creating && (
          <Field light={light} label="Status">
            <select {...bind("status")}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field light={light} label="Date of birth" optional><input type="date" {...bind("dateOfBirth")} /></Field>
        <Field light={light} label="Gender" optional>
          <select {...bind("gender")}>
            <option value="">Not specified</option>
            {GENDERS.map((g) => <option key={g} value={g}>{label(g)}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field light={light} label="Location" optional error={errors.location}><input type="text" {...bind("location")} /></Field>
        <Field light={light} label="Website" optional error={errors.website}><input type="url" placeholder="https://" {...bind("website")} /></Field>
      </div>
      <Field light={light} label="Bio" optional error={errors.bio}><textarea rows={3} {...bind("bio")} /></Field>
      {serverError && (
        <p role="alert" className={` border border-red-500/40 bg-red-500/10 px-3.5 py-3.5 text-sm ${light ? "text-red-700" : "text-red-300"}`}>{serverError}</p>
      )}
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className={`cursor-pointer border px-4 py-2 text-sm transition hover:opacity-80 ${light ? "border-[#E5E4E7]" : "border-[#263241]"}`}>Cancel</button>
        <button type="submit" disabled={saving} className="cursor-pointer px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-60" style={{ backgroundImage: "var(--accent-paint)" }}>
          {saving ? "Saving…" : creating ? "Create user" : "Save changes"}
        </button>
      </div>
    </form>
  );
};

export default function MasterDashboard() {
  const theme = useTheme();
  const light = theme.mainSectionTheme === "light";
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [hidden, setHidden] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? "[]");
      return Array.isArray(saved) ? saved.filter((k) => COLUMN_DEFS.some((c) => c.key === k)) : [];
    } catch {
      return [];
    }
  });
  const updateHidden = (next) => {
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable: the choice just won't persist
    }
  };
  const toggleColumn = (key) => {
    if (hidden.includes(key)) return updateHidden(hidden.filter((k) => k !== key));
    if (COLUMN_DEFS.length - hidden.length > 1) updateHidden([...hidden, key]); // always keep at least one column
  };
  const show = (key) => !hidden.includes(key);
  const visibleCols = COLUMN_DEFS.filter((c) => show(c.key));
  const [editing, setEditing] = useState(null); // null = closed, {} = create, user = edit
  const [deleting, setDeleting] = useState(null);
  const [viewing, setViewing] = useState(null); // user whose profile is open
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const stats = useMemo(
    () => [
      { label: "Total users", value: users.length },
      { label: "Active", value: users.filter((u) => u.enabled).length },
      { label: "Inactive", value: users.filter((u) => !u.enabled).length },
      { label: "Admins & master", value: users.filter((u) => u.role !== "USER").length },
    ],
    [users]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = FILTERS.find((f) => f.id === filter).match;
    const matches = users.filter(
      (u) => match(u) && (!q || [u.firstName, u.lastName, u.email, u.username, u.role].some((f) => f?.toLowerCase().includes(q)))
    );
    // the master account always sits at the bottom of the list (the rest keep their order)
    return [...matches.filter((u) => u.role !== "MASTER"), ...matches.filter((u) => u.role === "MASTER")];
  }, [users, query, filter]);

  const replaceUser = (saved) =>
    setUsers((list) => (list.some((u) => u.tenantId === saved.tenantId) ? list.map((u) => (u.tenantId === saved.tenantId ? saved : u)) : [saved, ...list]));

  const onSaved = (saved, created) => {
    replaceUser(saved);
    setEditing(null);
    setToast(created ? "User created" : "Changes saved");
  };

  const confirmDelete = async () => {
    const user = deleting;
    setBusyId(user.tenantId);
    setError("");
    try {
      await deleteUser(user.tenantId);
      setUsers((list) => list.filter((u) => u.tenantId !== user.tenantId));
      setToast("User deleted");
    } catch (e) {
      setError(e.message);
    } finally {
      setDeleting(null);
      setBusyId(null);
    }
  };

  const border = light ? "border-[#E5E4E7]" : "border-[#263241]";
  const muted = light ? "text-gray-600" : "text-[#AEBBCB]";
  const cell = light ? "text-gray-700" : "text-[#DCE4EE]";
  const iconBtn = `flex h-8 w-8 cursor-pointer items-center justify-center border-0 bg-transparent transition disabled:cursor-not-allowed disabled:opacity-40 ${
    light ? "text-gray-500 hover:bg-black/5 hover:text-gray-900" : "text-[#AEBBCB] hover:bg-white/8 hover:text-white"
  }`;
  const head = light ? "bg-white" : "bg-gray-950";
  const line = light ? "border-black/8" : "border-white/12";
  const card = light ? "bg-white" : "bg-gray-950";

  return (
    <div className={`h-full overflow-y-auto scrollable ${light ? "bg-white text-gray-900" : "bg-black text-white"}`}>
      <div className="w-full px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium tracking-widest text-(--accent-readable)">MASTER DASHBOARD</p>
            <h1 className="mt-1 text-2xl font-bold">Users</h1>
            <p className={`mt-1 text-sm ${muted}`}>Create, edit, disable and remove accounts across AIVerse.</p>
          </div>
          <button
            type="button"
            onClick={() => setEditing({})}
            className="flex w-full cursor-pointer items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 sm:w-auto"
            style={{ backgroundImage: "var(--accent-paint)" }}
          >
            <PlusIcon /> New user
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className={`px-3.5 py-3 sm:px-5 sm:py-4 ${light ? "bg-gray-50" : "bg-gray-950"}`}>
              <p className={`text-xs ${muted}`}>{s.label}</p>
              <p className="mt-1 text-xl font-bold sm:text-2xl">{loading ? "–" : s.value}</p>
            </div>
          ))}
        </div>

        {error && (
          <p role="alert" className={`mt-4 border border-red-500/40 bg-red-500/10 px-3.5 py-3.5 text-sm ${light ? "text-red-700" : "text-red-300"}`}>{error}</p>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:mt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className={`scrollable flex h-10 w-full items-stretch overflow-x-auto border p-0.5 sm:w-auto ${light ? "border-[#E5E4E7] bg-white" : "border-[#2A3649] bg-black"}`}>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`flex-1 cursor-pointer border-0 px-3 py-1.5 text-sm whitespace-nowrap transition sm:flex-none ${filter === f.id ? "font-medium text-(--accent-readable)" : `bg-transparent ${muted}`}`}
                style={filter === f.id ? { background: "color-mix(in srgb, var(--accent-color) 10%, transparent)" } : undefined}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex w-full items-center gap-3 sm:w-auto">
            <ColumnPicker light={light} hidden={hidden} onToggle={toggleColumn} onReset={() => updateHidden([])} />
            <div className="min-w-0 flex-1 sm:flex-none">
              <SearchBox light={light} value={query} onChange={setQuery} />
            </div>
          </div>
        </div>

        <div className={`mt-4 overflow-x-auto scrollable ${card}`}>
          <table className="w-full border-collapse text-left text-[13px]" style={{ minWidth: `${visibleCols.length * 130 + 90}px` }}>
            <thead className={`text-[10.5px] tracking-widest whitespace-nowrap uppercase ${light ? "text-gray-500" : "text-[#C3CEDB]"}`}>
              <tr className={`border-b ${line} ${head}`}>
                {visibleCols.map((c) => (
                  <th key={c.key} className={`px-3.5 py-3 font-medium ${c.key === "dp" ? `sticky left-0 z-10 ${head}` : ""}`}>{c.label}</th>
                ))}
                <th className={`sticky right-0 z-10 px-3.5 py-3 ${head}`} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }, (_, i) => (
                  <tr key={i} className={`border-b last:border-b-0 ${line}`}>
                    <td colSpan={visibleCols.length + 1} className="px-3.5 py-3"><div className={`h-9 animate-pulse ${light ? "bg-black/5" : "bg-white/5"}`} /></td>
                  </tr>
                ))
              ) : visible.length === 0 ? (
                <tr>
                  <td colSpan={visibleCols.length + 1} className="px-4 py-14 text-center">
                    <div className={`mx-auto mb-3 flex w-fit ${muted}`}><UsersIcon /></div>
                    <p className="font-medium">{users.length ? "No users match your filters" : "No users yet"}</p>
                    <p className={`mt-1 text-sm ${muted}`}>{users.length ? "Try a different search or filter." : "Create the first account to get started."}</p>
                  </td>
                </tr>
              ) : (
                visible.map((u) => {
                  const isMaster = u.role === "MASTER";
                  const busy = busyId === u.tenantId;
                  return (
                    <tr key={u.tenantId} className={`border-b transition-colors last:border-b-0 ${line} ${card} ${light ? "hover:bg-gray-50" : "hover:bg-gray-900"}`}>
                      {show("dp") && (
                        <td className="sticky left-0 z-10 bg-inherit px-3.5 py-2"><Avatar user={u} premium={isMaster} /></td>
                      )}
                      {show("firstName") && (
                        <td className="px-3.5 py-3.5 font-medium whitespace-nowrap">{u.firstName}</td>
                      )}
                      {show("lastName") && (
                        <td className="px-3.5 py-3.5 font-medium whitespace-nowrap">{u.lastName}</td>
                      )}
                      {show("username") && (
                        <td className={`px-3.5 py-3.5 whitespace-nowrap ${cell}`}>@{u.username}</td>
                      )}
                      {show("email") && (
                        <td className={`px-3.5 py-3.5 whitespace-nowrap ${cell}`}>{u.email}</td>
                      )}
                      {show("phone") && (
                        <td className={`px-3.5 py-3.5 whitespace-nowrap ${cell}`}>{u.phoneNumber || <Empty />}</td>
                      )}
                      {show("dob") && (
                        <td className={`px-3.5 py-3.5 whitespace-nowrap ${cell}`}>{u.dateOfBirth ? fmtDate(u.dateOfBirth) : <Empty />}</td>
                      )}
                      {show("gender") && (
                        <td className="px-3.5 py-3.5">{u.gender ? <Badge tone={genderTone(u.gender)}>{label(u.gender)}</Badge> : <Badge>Not specified</Badge>}</td>
                      )}
                      {show("accountType") && (
                        <td className="px-3.5 py-3.5">{<Badge tone="teal">{u.accountType ? label(u.accountType) : "General user"}</Badge>}</td>
                      )}
                      {show("location") && (
                        <td className={`px-3.5 py-3.5 whitespace-nowrap ${cell}`}>{u.location || <Empty />}</td>
                      )}
                      {show("website") && (
                        <td className={`px-3.5 py-3.5 whitespace-nowrap ${cell}`}>
                          {u.website ? <a href={u.website} target="_blank" rel="noreferrer noopener" className="text-(--accent-readable) hover:underline">{u.website}</a> : <Empty>No website</Empty>}
                        </td>
                      )}
                      {show("bio") && (
                        <td className={`max-w-64 truncate px-3.5 py-3.5 ${muted}`} title={u.bio || undefined}>{u.bio || <Empty>No bio yet</Empty>}</td>
                      )}
                      {show("role") && (
                        <td className="px-3.5 py-3.5">
                          <Badge tone={roleTone(u.role)}>{u.role}</Badge>
                        </td>
                      )}
                      {show("status") && (
                        <td className="px-3.5 py-3.5">
                          <StatusBadge user={u} />
                        </td>
                      )}
                      {show("emailVerified") && (
                        <td className="px-3.5 py-3.5"><Verified ok={u.emailVerified} /></td>
                      )}
                      {show("phoneVerified") && (
                        <td className="px-3.5 py-3.5"><Verified ok={u.phoneVerified} /></td>
                      )}
                      {show("created") && (
                        <td className={`px-3.5 py-3.5 text-xs whitespace-nowrap ${cell}`}>{fmtDate(u.createdAt)}</td>
                      )}
                      {show("updated") && (
                        <td className={`px-3.5 py-3.5 text-xs whitespace-nowrap ${cell}`}>{fmtDate(u.updatedAt)}</td>
                      )}
                      <td className="sticky right-0 z-10 bg-inherit px-3.5 py-2">
                        {/* Desktop: the three buttons side by side */}
                        <div className="hidden items-center justify-end gap-1 md:flex">
                          <button type="button" aria-label={`View ${u.username}`} title="View profile" className={iconBtn} onClick={() => setViewing(u)}><EyeIcon /></button>
                          {!isMaster && (
                            <>
                              <button type="button" aria-label={`Edit ${u.username}`} title="Edit" className={iconBtn} onClick={() => setEditing(u)}><EditIcon /></button>
                              <button type="button" aria-label={`Delete ${u.username}`} title="Delete" className={`${iconBtn} hover:text-red-400!`} disabled={busy} onClick={() => setDeleting(u)}><TrashIcon /></button>
                            </>
                          )}
                        </div>
                        {/* Mobile and smaller screens: the same actions folded into a three-dot menu */}
                        <div className="md:hidden">
                          <RowMenu
                            light={light}
                            busy={busy}
                            label={`Actions for ${u.username}`}
                            items={[
                              { label: "View profile", icon: <EyeIcon />, onClick: () => setViewing(u) },
                              ...(isMaster
                                ? []
                                : [
                                    { label: "Edit", icon: <EditIcon />, onClick: () => setEditing(u) },
                                    { label: "Delete", icon: <TrashIcon />, danger: true, onClick: () => setDeleting(u) },
                                  ]),
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && users.length > 0 && (
          <p className={`mt-3 text-xs ${muted}`}>Showing {visible.length} of {users.length} users</p>
        )}
      </div>

      {viewing && (
        <ProfileDrawer
          key={viewing.tenantId}
          light={light}
          user={users.find((u) => u.tenantId === viewing.tenantId) ?? viewing}
          onClose={() => setViewing(null)}
          onEdit={(u) => {
            setViewing(null);
            setEditing(u);
          }}
        />
      )}

      {editing && (
        <Modal
          light={light}
          title={editing.tenantId ? "Edit user" : "New user"}
          subtitle={editing.tenantId ? editing.email : "The account can sign in right away with this password."}
          onClose={() => setEditing(null)}
        >
          <UserForm light={light} user={editing.tenantId ? editing : null} onSaved={onSaved} onClose={() => setEditing(null)} />
        </Modal>
      )}

      {deleting && (
        <Modal light={light} title="Delete user" onClose={() => setDeleting(null)}>
          <p className={`text-sm ${muted}`}>
            Permanently delete <strong className={light ? "text-gray-900" : "text-white"}>{deleting.firstName} {deleting.lastName}</strong> ({deleting.email})? This cannot be undone.
          </p>
          <div className="flex justify-end gap-3 pt-5">
            <button type="button" onClick={() => setDeleting(null)} className={`cursor-pointer border px-4 py-2 text-sm transition hover:opacity-80 ${border}`}>Cancel</button>
            <button type="button" onClick={confirmDelete} disabled={busyId === deleting.tenantId} className="cursor-pointer bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-60">
              {busyId === deleting.tenantId ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}

      {toast && (
        <div role="status" className={`fixed right-3 bottom-24 left-3 z-50 border px-4 py-2.5 text-sm shadow-lg sm:left-auto sm:right-5 ${light ? "border-[#E5E4E7] bg-white" : "border-[#263241] bg-[#0B0F17]"}`}>
          <span className="mr-2 text-(--accent-readable)">●</span>{toast}
        </div>
      )}
    </div>
  );
}
