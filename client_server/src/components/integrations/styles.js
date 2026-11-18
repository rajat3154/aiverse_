// Design tokens for the integrations screens. They deliberately mirror the LLM Providers and Credentials pages:
// square corners, hairline borders, black / white surfaces, the accent gradient on primary actions and
// --accent-readable for links and eyebrows, so the whole app reads as one product.
export const getStyles = (isLight) => ({
  page: isLight ? "bg-white text-gray-900" : "bg-black text-white",
  muted: isLight ? "text-gray-500" : "text-[#8B98A8]",
  body: isLight ? "text-gray-600" : "text-[#AEBBCB]",
  surface: isLight ? "bg-white border-black/8" : "bg-black border-white/10",
  raised: isLight ? "bg-gray-50" : "bg-white/4",
  divider: isLight ? "border-black/8" : "border-white/10",
  line: isLight ? "border-[#E5E4E7]" : "border-[#263241]/60",
  card: `flex flex-col gap-3 border p-4 transition-colors ${
    isLight ? "bg-white border-black/8 hover:border-black/20" : "bg-black border-white/10 hover:border-white/25"
  }`,
  row: `flex flex-wrap items-center gap-x-4 gap-y-2 border px-4 py-3 transition-colors sm:flex-nowrap ${
    isLight ? "bg-white border-black/8 hover:border-black/20" : "bg-black border-white/10 hover:border-white/25"
  }`,
  button: `cursor-pointer border px-3 py-1.5 text-[12.5px] font-medium transition-colors max-sm:min-h-10 max-sm:px-3.5 disabled:cursor-not-allowed disabled:opacity-50 ${
    isLight ? "border-black/10 text-gray-900 hover:bg-black/4" : "border-white/10 text-white hover:bg-white/6"
  }`,
  primary:
    "cursor-pointer border-0 bg-(image:--accent-paint) px-3 py-1.5 text-[12.5px] font-semibold text-black transition hover:opacity-90 max-sm:min-h-10 max-sm:px-3.5 disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "cursor-pointer border border-rose-400/40 bg-transparent px-3 py-1.5 text-[12.5px] font-medium text-rose-400 transition-colors hover:bg-rose-400/10 max-sm:min-h-10 max-sm:px-3.5 disabled:cursor-not-allowed disabled:opacity-50",
  link: "cursor-pointer border-0 bg-transparent p-0 text-[12.5px] font-medium text-(--accent-readable) hover:underline disabled:cursor-not-allowed disabled:opacity-50",
  input: `border px-3 py-2 text-base outline-none transition sm:text-sm focus:border-(--accent-color) ${
    isLight ? "bg-white border-black/10 text-gray-900 placeholder:text-gray-400" : "bg-black border-white/10 text-white placeholder:text-[#8B98A8]"
  }`,
  label: "text-[11px] font-semibold uppercase tracking-wider",
  heading: "mb-3 text-[11px] font-semibold uppercase tracking-wider",
  error: "px-3.5 py-2.5 text-[13px] bg-rose-400/10 text-rose-400",
  chip: isLight ? "bg-black/5 text-gray-600" : "bg-white/10 text-[#B4C0CE]",
  mono: "font-mono text-[11px]",
  tab: (active) =>
    `cursor-pointer whitespace-nowrap border-0 border-b-2 bg-transparent px-0.5 pb-2.5 pt-1 text-sm transition-colors ${
      active ? "border-(--accent-color) font-semibold text-(--accent-readable)" : `border-transparent ${isLight ? "text-gray-500" : "text-[#8B98A8]"} hover:text-inherit`
    }`,
});

export const STATUS_TONES = {
  ACTIVE: "text-emerald-400 bg-emerald-400/10",
  INITIATED: "text-amber-400 bg-amber-400/10",
  INITIALIZING: "text-amber-400 bg-amber-400/10",
  FAILED: "text-rose-400 bg-rose-400/10",
  EXPIRED: "text-rose-400 bg-rose-400/10",
  INACTIVE: "text-rose-400 bg-rose-400/10",
  REVOKED: "text-rose-400 bg-rose-400/10",
};

export const STATUS_DOTS = {
  ACTIVE: "bg-emerald-400",
  INITIATED: "bg-amber-400",
  INITIALIZING: "bg-amber-400",
  FAILED: "bg-rose-400",
  EXPIRED: "bg-rose-400",
  INACTIVE: "bg-gray-400",
  REVOKED: "bg-gray-400",
};

export const STATUS_LABELS = {
  ACTIVE: "Connected",
  INITIATED: "Waiting for authorization",
  INITIALIZING: "Starting",
  FAILED: "Failed",
  EXPIRED: "Expired",
  INACTIVE: "Inactive",
  REVOKED: "Revoked",
};

export const NEUTRAL_TONE = "bg-white/10 text-[#B4C0CE]";
