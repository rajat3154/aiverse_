import { useEffect, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { exchangeOAuthCode } from "../../services/authService";

// A code can be redeemed only once, and React StrictMode runs effects twice in development.
// Sharing one in-flight request per code keeps the second run from burning the code.
const exchanges = new Map();
const exchangeOnce = (code) => {
  if (!exchanges.has(code)) exchanges.set(code, exchangeOAuthCode(code));
  return exchanges.get(code);
};

const OAuthCallbackPage = () => {
  const theme = useTheme();
  const light = theme.mainSectionTheme === "light";
  const [error, setError] = useState("");

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    // Take the code out of the address bar and history straight away.
    window.history.replaceState(null, "", window.location.pathname);

    if (!code) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("The sign-in link is missing its code. Please try again.");
      return;
    }

    exchangeOnce(code)
      .then(() => window.location.replace("/"))
      .catch((err) => setError(err.message || "We could not complete your sign-in. Please try again."));
  }, []);

  return (
    <div className={`flex min-h-dvh w-full items-center justify-center px-4 ${light ? "bg-[#F4F7FA] text-gray-900" : "bg-black text-white"}`}>
      <div className="w-full max-w-sm text-center">
        {error ? (
          <>
            <h1 className="text-xl font-semibold">Sign-in failed</h1>
            <p role="alert" className={`mt-3 text-sm ${light ? "text-red-700" : "text-red-300"}`}>
              {error}
            </p>
            <a
              href="/login"
              className="mt-6 inline-block px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
              style={{ backgroundImage: "var(--accent-paint)" }}
            >
              Back to sign in
            </a>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Signing you in…</h1>
            <p className={`mt-3 text-sm ${light ? "text-gray-600" : "text-[#8FA0B3]"}`}>Just a moment.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default OAuthCallbackPage;
