import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, API_ROUTES } from "../../config/api";
import { useTheme } from "../../context/ThemeContext";

const highlights = [
  {
    title: "Workflows",
    color: "#F59E0B",
    tags: ["Automation", "Triggers"],
    description: "Chain triggers, LLM calls, tools and branches into reliable, repeatable flows.",
    icon: <path d="M3 3h6v6H3zM15 3h6v6h-6zM15 15h6v6h-6zM9 6h6M18 9v6M6 9v3a3 3 0 003 3h6" />,
  },
  {
    title: "AI Agents",
    color: "#6366F1",
    tags: ["Memory", "Tools"],
    description: "Agents with their own instructions, memory and tools that work on your behalf.",
    icon: <path d="M6 8h12a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8a2 2 0 012-2zM12 8V4M9 14h.01M15 14h.01" />,
  },
  {
    title: "Any LLM provider",
    color: "#10B981",
    tags: ["OpenAI", "Anthropic"],
    description: "OpenAI, Anthropic, Google and open models — switch without changing your flows.",
    icon: <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />,
  },
  {
    title: "Tools & MCP",
    color: "#0EA5E9",
    tags: ["Composio", "MCP"],
    description: "Connect apps and data through Composio integrations and MCP servers.",
    icon: <path d="M14.7 6.3a4 4 0 005.4 5.4l-9.4 9.4a2.1 2.1 0 01-3-3l9.4-9.4a4 4 0 00-2.4-2.4z" />,
  },
];

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // matches the server's upload limit

const INITIAL = {
  firstName: "",
  lastName: "",
  email: "",
  username: "",
  phoneNumber: "",
  dateOfBirth: "",
  gender: "",
  password: "",
  confirmPassword: "",
};

// Mirrors the validation rules of SignupRequest on the server.
const validate = (v) => {
  const e = {};
  if (!v.firstName.trim()) e.firstName = "First name is required";
  if (!v.lastName.trim()) e.lastName = "Last name is required";
  if (!v.email.trim()) e.email = "Email is required";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) e.email = "Invalid email address";
  if (!v.username) e.username = "Username is required";
  else if (v.username.length < 3 || v.username.length > 50) e.username = "Username must be between 3 and 50 characters";
  else if (!/^[a-zA-Z0-9_.]+$/.test(v.username)) e.username = "Only letters, numbers, underscores and dots";
  if (v.phoneNumber && !/^[+]?[0-9]{10,15}$/.test(v.phoneNumber)) e.phoneNumber = "Invalid phone number";
  if (!v.password) e.password = "Password is required";
  else if (v.password.length < 8) e.password = "Password must be at least 8 characters";
  if (!v.confirmPassword) e.confirmPassword = "Confirm your password";
  else if (v.confirmPassword !== v.password) e.confirmPassword = "Passwords do not match";
  return e;
};

const inputClass = (hasError, light) =>
  `w-full min-w-0 border px-3.5 py-3 text-base outline-none sm:py-2.5 sm:text-sm transition focus:border-(--accent-color) focus:ring-2 focus:ring-(--accent-soft) ${
    light ? "bg-white text-gray-900 placeholder:text-gray-400" : "bg-[#0B1220] text-white placeholder:text-[#5B6B7E]"
  } ${hasError ? "border-red-500/70" : light ? "border-[#E5E4E7]" : "border-[#263241]"}`;

const Field = ({ label, error, children, optional, light }) => (
  <label className="block min-w-0">
    <span className={`mb-1.5 flex items-center justify-between text-xs font-medium ${light ? "text-gray-700" : "text-[#B8C4D0]"}`}>
      {label}
      {optional && <span className={light ? "text-gray-400" : "text-[#5B6B7E]"}>Optional</span>}
    </span>
    {children}
    {error && <span className={`mt-1 block text-xs ${light ? "text-red-600" : "text-red-400"}`}>{error}</span>}
  </label>
);

// One feature as a plain card.
const FeatureCard = ({ h, i, light }) => (
  <li
    className={`node-in group flex flex-col border p-5 transition ${
      light ? "border-[#E5E4E7] bg-white" : "border-[#263241] bg-linear-to-br from-[#101826] to-[#06090F]"
    } duration-300 hover:-translate-y-0.5 hover:border-(--c) hover:shadow-[0_10px_30px_-10px_var(--c)]`}
    style={{ animationDelay: `${i * 90}ms`, "--c": h.color }}
  >
    <span
      className="flex h-10 w-10 items-center justify-center text-white"
      style={{ backgroundImage: `linear-gradient(135deg, ${h.color}, ${h.color}99)`, boxShadow: `0 6px 16px -6px ${h.color}` }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {h.icon}
      </svg>
    </span>
    <p className={`mt-4 text-sm font-semibold ${light ? "text-gray-900" : "text-white"}`}>{h.title}</p>
    <p className={`mt-1.5 text-xs leading-relaxed ${light ? "text-gray-600" : "text-[#8FA0B3]"}`}>{h.description}</p>
  </li>
);

const ThemeToggle = ({ light, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
    title={light ? "Switch to dark theme" : "Switch to light theme"}
    className={`absolute right-4 top-4 flex h-9 w-9 cursor-pointer items-center justify-center border bg-transparent transition hover:border-(--accent-color) hover:text-(--accent-readable) ${
      light ? "border-[#E5E4E7] text-gray-700" : "border-[#263241] text-[#B8C4D0]"
    }`}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {light ? (
        <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
      ) : (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      )}
    </svg>
  </button>
);

const SignupPage = () => {
  const theme = useTheme();
  const leftLight = theme.leftSidebarTheme === "light";
  const light = theme.mainSectionTheme === "light";
  // One switch for the whole page: both sides follow it, like the theme settings in the app sidebar.
  const toggleTheme = () => {
    const next = light ? "dark" : "light";
    theme.setMainSectionTheme(next);
    theme.setLeftSidebarTheme(next);
  };
  const [values, setValues] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [done, setDone] = useState(false);
  // Profile photo: `preview` is a local blob while uploading, `url` is the Cloudinary link sent with the form.
  const [photo, setPhoto] = useState({ url: "", preview: "", uploading: false, error: "" });
  const fileInput = useRef(null);

  useEffect(() => () => photo.preview && URL.revokeObjectURL(photo.preview), [photo.preview]);

  const onPhotoChosen = async (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = ""; // allow choosing the same file again
    if (!file) return;
    if (!file.type.startsWith("image/")) return setPhoto((c) => ({ ...c, error: "Please choose an image file" }));
    if (file.size > MAX_PHOTO_BYTES) return setPhoto((c) => ({ ...c, error: "Image must be 10 MB or smaller" }));

    setPhoto({ url: "", preview: URL.createObjectURL(file), uploading: true, error: "" });
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE_URL ?? ""}${API_ROUTES.identity}/cloudinary/upload`, { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      const url = data?.file?.secure_url;
      if (!res.ok || !url) throw new Error(data.message || `Upload failed (HTTP ${res.status})`);
      setPhoto((c) => ({ ...c, url, uploading: false }));
    } catch (error) {
      // fetch itself rejects with a TypeError when the server cannot be reached
      const message = error instanceof TypeError ? "Cannot reach the server. Is it running?" : error.message;
      setPhoto({ url: "", preview: "", uploading: false, error: message || "Upload failed" });
    }
  };

  const removePhoto = () => setPhoto({ url: "", preview: "", uploading: false, error: "" });

  const bind = (name) => ({
    name,
    value: values[name],
    onChange: (ev) => {
      setValues((c) => ({ ...c, [name]: ev.target.value }));
      if (errors[name]) setErrors((c) => ({ ...c, [name]: undefined }));
    },
    className: inputClass(Boolean(errors[name]), light),
  });

  const onSubmit = async (ev) => {
    ev.preventDefault();
    setServerError("");
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length || photo.uploading) return;

    const body = {
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      email: values.email.trim(),
      username: values.username,
      password: values.password,
      confirmPassword: values.confirmPassword,
      accountType: "GENERAL_USER",
      ...(photo.url && { profilePhoto: photo.url }),
      ...(values.phoneNumber && { phoneNumber: values.phoneNumber }),
      ...(values.dateOfBirth && { dateOfBirth: values.dateOfBirth }),
      ...(values.gender && { gender: values.gender }),
    };

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL ?? ""}${API_ROUTES.identity}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setServerError(data.message || data.error || "Could not create your account. Please try again.");
        return;
      }
      setDone(true);
    } catch {
      setServerError("Unable to reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-dvh w-full">
      {/* Left: platform information */}
      <aside
        className={`relative hidden w-1/2 max-w-[720px] flex-col overflow-hidden border-r p-12 lg:flex ${
          leftLight ? "border-[#E5E4E7] bg-white text-gray-900" : "border-[#263241]/60 bg-linear-to-b from-[#030712] to-black text-white"
        }`}
      >
        <div className="relative flex items-baseline gap-0.5 text-2xl">
          <span className="font-bold tracking-wider">AI</span>
          <span className="font-bold tracking-wider bg-clip-text text-transparent" style={{ backgroundImage: "var(--accent-paint)" }}>
            VERSE
          </span>
        </div>

        <div className="relative my-auto py-10">
          <h1 className="text-4xl font-bold leading-tight">
            Build, connect and run{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--accent-paint)" }}>
              AI agents
            </span>{" "}
            in one place.
          </h1>
          <p className={`mt-4 max-w-md ${leftLight ? "text-gray-600" : "text-[#B8C4D0]"}`}>
            AIVerse is a workspace for orchestrating LLMs, tools and workflows — from first prototype to always-on automation.
          </p>

          <ul className="mt-10 grid grid-cols-2 auto-rows-fr gap-4">
            {highlights.map((h, i) => (
              <FeatureCard key={h.title} h={h} i={i} light={leftLight} />
            ))}
          </ul>
        </div>
      </aside>

      {/* Right: form */}
      <main
        className={`relative flex flex-1 items-center justify-center overflow-y-auto px-4 pb-10 pt-16 sm:px-8 lg:py-10 ${
          light ? "bg-[#F4F7FA] text-gray-900" : "bg-black text-white"
        }`}
      >
        <ThemeToggle light={light} onToggle={toggleTheme} />
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-baseline gap-0.5 text-xl">
              <span className="font-bold tracking-wider">AI</span>
              <span className="font-bold tracking-wider bg-clip-text text-transparent" style={{ backgroundImage: "var(--accent-paint)" }}>
                VERSE
              </span>
            </div>
            <p className={`mt-2 text-sm ${light ? "text-gray-600" : "text-[#8FA0B3]"}`}>
              Build, connect and run AI agents, LLM workflows and tools in one place.
            </p>
          </div>

          {done ? (
            <div className=" border border-(--accent-border) bg-(--accent-soft) p-6">
              <h2 className="text-xl font-semibold">Account created</h2>
              <p className={`mt-2 text-sm ${light ? "text-gray-600" : "text-[#B8C4D0]"}`}>
                Welcome to AIVerse, {values.firstName}. You can now sign in with {values.email}.
              </p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold">Create your account</h2>
              <p className={`mt-1 text-sm ${light ? "text-gray-600" : "text-[#8FA0B3]"}`}>Start building with AIVerse in a minute.</p>

              <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
                <div className="flex items-center gap-4">
                  <div
                    className={`relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border ${
                      light ? "border-[#E5E4E7] bg-white text-gray-400" : "border-[#263241] bg-[#0B1220] text-[#5B6B7E]"
                    }`}
                  >
                    {photo.preview ? (
                      <img src={photo.preview} alt="Profile preview" className="h-full w-full object-cover" />
                    ) : (
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
                      </svg>
                    )}
                    {photo.uploading && (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] font-medium text-white">
                        Uploading
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium ${light ? "text-gray-700" : "text-[#B8C4D0]"}`}>
                      Profile photo <span className={light ? "text-gray-400" : "text-[#5B6B7E]"}>Optional</span>
                    </p>
                    <div className="mt-1.5 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => fileInput.current?.click()}
                        disabled={photo.uploading}
                        className={`cursor-pointer border px-3 py-1.5 text-xs font-medium transition hover:border-(--accent-color) hover:text-(--accent-readable) disabled:cursor-not-allowed disabled:opacity-60 ${
                          light ? "border-[#E5E4E7] text-gray-700" : "border-[#263241] text-[#B8C4D0]"
                        }`}
                      >
                        {photo.preview ? "Change" : "Upload photo"}
                      </button>
                      {photo.preview && !photo.uploading && (
                        <button type="button" onClick={removePhoto} className="cursor-pointer text-xs text-red-400 hover:underline">
                          Remove
                        </button>
                      )}
                    </div>
                    {photo.error && <p className={`mt-1 text-xs ${light ? "text-red-600" : "text-red-400"}`}>{photo.error}</p>}
                    <input ref={fileInput} type="file" accept="image/*" onChange={onPhotoChosen} className="hidden" />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field light={light} label="First name" error={errors.firstName}>
                    <input type="text" autoComplete="given-name" placeholder="Ada" {...bind("firstName")} />
                  </Field>
                  <Field light={light} label="Last name" error={errors.lastName}>
                    <input type="text" autoComplete="family-name" placeholder="Lovelace" {...bind("lastName")} />
                  </Field>
                </div>

                <Field light={light} label="Email" error={errors.email}>
                  <input type="email" autoComplete="email" placeholder="you@example.com" {...bind("email")} />
                </Field>

                <Field light={light} label="Username" error={errors.username}>
                  <input type="text" autoComplete="username" placeholder="ada_lovelace" {...bind("username")} />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field light={light} label="Phone" error={errors.phoneNumber} optional>
                    <input type="tel" autoComplete="tel" placeholder="+911234567890" {...bind("phoneNumber")} />
                  </Field>
                  <Field light={light} label="Date of birth" optional>
                    <input type="date" autoComplete="bday" {...bind("dateOfBirth")} style={{ colorScheme: light ? "light" : "dark" }} />
                  </Field>
                </div>

                <Field light={light} label="Gender" optional>
                  <select {...bind("gender")}>
                    <option value="">Prefer not to say</option>
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field light={light} label="Password" error={errors.password}>
                    <input type="password" autoComplete="new-password" placeholder="Min. 8 characters" {...bind("password")} />
                  </Field>
                  <Field light={light} label="Confirm password" error={errors.confirmPassword}>
                    <input type="password" autoComplete="new-password" placeholder="Repeat password" {...bind("confirmPassword")} />
                  </Field>
                </div>

                {serverError && (
                  <p role="alert" className={` border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-sm ${light ? "text-red-700" : "text-red-300"}`}>
                    {serverError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting || photo.uploading}
                  className="w-full cursor-pointer px-4 py-3 text-base font-semibold sm:py-2.5 sm:text-sm text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundImage: "var(--accent-paint)" }}
                >
                  {submitting ? "Creating account…" : "Create account"}
                </button>

                <p className={`text-center text-sm ${light ? "text-gray-600" : "text-[#8FA0B3]"}`}>
                  Already have an account?{" "}
                  <a href="/login" className="font-medium text-(--accent-readable) hover:underline">
                    Sign in
                  </a>
                </p>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default SignupPage;
