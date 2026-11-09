import { useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { login } from "../../services/authService";
import { Field } from "./AuthFields";
import { inputClass } from "./inputClass";
import AuthLayout from "./AuthLayout";

const INITIAL = { identifier: "", password: "" };

// Mirrors the validation rules of LoginRequest on the gateway.
const validate = (v) => {
  const e = {};
  if (!v.identifier.trim()) e.identifier = "Email or username is required";
  if (!v.password) e.password = "Password is required";
  return e;
};

const LoginPage = () => {
  const theme = useTheme();
  const light = theme.mainSectionTheme === "light";
  const [values, setValues] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");

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
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      await login(values.identifier, values.password);
      window.location.replace("/");
    } catch (error) {
      setServerError(error.message || "Could not sign you in. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      <h2 className="text-2xl font-bold">Welcome back</h2>
      <p className={`mt-1 text-sm ${light ? "text-gray-600" : "text-[#8FA0B3]"}`}>Sign in to continue to AIVerse.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-4">
        <Field light={light} label="Email or username" error={errors.identifier}>
          <input type="text" autoComplete="username" placeholder="you@example.com" autoFocus {...bind("identifier")} />
        </Field>

        <Field light={light} label="Password" error={errors.password}>
          <input type="password" autoComplete="current-password" placeholder="Your password" {...bind("password")} />
        </Field>

        {serverError && (
          <p role="alert" className={`border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-sm ${light ? "text-red-700" : "text-red-300"}`}>
            {serverError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full cursor-pointer px-4 py-3 text-base font-semibold sm:py-2.5 sm:text-sm text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ backgroundImage: "var(--accent-paint)" }}
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>

        <p className={`text-center text-sm ${light ? "text-gray-600" : "text-[#8FA0B3]"}`}>
          New to AIVerse?{" "}
          <a href="/signup" className="font-medium text-(--accent-readable) hover:underline">
            Create an account
          </a>
        </p>
      </form>
    </AuthLayout>
  );
};

export default LoginPage;
