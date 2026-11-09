import { oauthLoginUrl } from "../../services/authService";

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.4 12 2.4 6.9 2.4 2.8 6.5 2.8 11.6S6.9 20.8 12 20.8c5.3 0 8.8-3.7 8.8-9 0-.6-.1-1.1-.2-1.6H12z" />
  </svg>
);

const GitHubIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 .5a11.5 11.5 0 00-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 015.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0012 .5z" />
  </svg>
);

const PROVIDERS = [
  { id: "google", label: "Google", Icon: GoogleIcon },
  { id: "github", label: "GitHub", Icon: GitHubIcon },
];

/** "Continue with Google / GitHub". The whole OAuth round trip happens on the gateway, so this is a plain navigation. */
const OAuthButtons = ({ light, verb = "Continue" }) => (
  <div>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {PROVIDERS.map(({ id, label, Icon }) => (
        <a
          key={id}
          href={oauthLoginUrl(id)}
          className={`flex items-center justify-center gap-2.5 border px-4 py-3 text-base font-medium no-underline transition hover:border-(--accent-color) sm:py-2.5 sm:text-sm ${
            light ? "border-[#E5E4E7] bg-white text-gray-900" : "border-[#263241] bg-[#0B1220] text-white"
          }`}
        >
          <Icon />
          {verb} with {label}
        </a>
      ))}
    </div>
    <div className="my-5 flex items-center gap-3" aria-hidden="true">
      <span className={`h-px flex-1 ${light ? "bg-[#E5E4E7]" : "bg-[#263241]"}`} />
      <span className={`text-xs ${light ? "text-gray-400" : "text-[#5B6B7E]"}`}>or</span>
      <span className={`h-px flex-1 ${light ? "bg-[#E5E4E7]" : "bg-[#263241]"}`} />
    </div>
  </div>
);

export default OAuthButtons;
