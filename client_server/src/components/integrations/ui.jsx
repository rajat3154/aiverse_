import { useState } from "react";
import { STATUS_DOTS } from "./styles";

export function Chip({ className, children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

export function StatusDot({ status, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium">
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOTS[status] ?? "bg-gray-400"}`} />
      {label}
    </span>
  );
}

const SIZES = { md: "h-10 w-10 text-sm", lg: "h-12 w-12 text-base", xl: "h-14 w-14 text-lg" };

export function ToolkitLogo({ toolkit, isLight, size = "md" }) {
  const [failed, setFailed] = useState(false);
  const box = `flex shrink-0 items-center justify-center overflow-hidden rounded-md ${SIZES[size]} ${isLight ? "bg-black/5" : "bg-white/8"}`;
  if (toolkit.logo && !failed) {
    return (
      <span className={box}>
        <img src={toolkit.logo} alt={`${toolkit.name ?? toolkit.slug} logo`} onError={() => setFailed(true)} className="h-full w-full object-contain" />
      </span>
    );
  }
  const label = toolkit.name || toolkit.slug || "?";
  return <span className={`${box} font-bold ${isLight ? "text-gray-500" : "text-[#AEBBCB]"}`}>{label.charAt(0).toUpperCase()}</span>;
}

export function Skeleton({ isLight, className = "" }) {
  return <div className={`animate-pulse ${isLight ? "bg-black/6" : "bg-white/8"} ${className}`} />;
}

export function EmptyState({ title, children, isLight }) {
  return (
    <div className={`border border-dashed py-16 text-center text-sm ${isLight ? "border-black/10 text-gray-500" : "border-white/10 text-[#8B98A8]"}`}>
      <p className={`m-0 font-medium ${isLight ? "text-gray-700" : "text-[#C9D3E0]"}`}>{title}</p>
      {children && <div className="mt-1 text-[13px]">{children}</div>}
    </div>
  );
}
