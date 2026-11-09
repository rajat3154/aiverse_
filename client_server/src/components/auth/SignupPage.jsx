import { useEffect, useRef, useState } from "react";
import { API_BASE_URL, API_ROUTES } from "../../config/api";
import { useTheme } from "../../context/ThemeContext";
import { Field } from "./AuthFields";
import { inputClass } from "./inputClass";
import AuthLayout from "./AuthLayout";
import OAuthButtons from "./OAuthButtons";

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

const SignupPage = () => {
  const theme = useTheme();
  const light = theme.mainSectionTheme === "light";
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
    <AuthLayout>
          {done ? (
            <div className=" border border-(--accent-border) bg-(--accent-soft) p-6">
              <h2 className="text-xl font-semibold">Account created</h2>
              <p className={`mt-2 text-sm ${light ? "text-gray-600" : "text-[#B8C4D0]"}`}>
                Welcome to AIVerse, {values.firstName}. You can now sign in with {values.email}.
              </p>
              <a
                href="/login"
                className="mt-5 inline-block px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
                style={{ backgroundImage: "var(--accent-paint)" }}
              >
                Go to sign in
              </a>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold">Create your account</h2>
              <p className={`mt-1 text-sm ${light ? "text-gray-600" : "text-[#8FA0B3]"}`}>Start building with AIVerse in a minute.</p>

              <div className="mt-8">
                <OAuthButtons light={light} verb="Sign up" />
              </div>

              <form onSubmit={onSubmit} noValidate className="space-y-4">
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
    </AuthLayout>
  );
};

export default SignupPage;
