// The two message bubbles of the playground chat. The human bubble is filled with the accent, the AI bubble is an outlined panel.
export function HumanBubble({ children, label = "You", isLight }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <span className={`text-[11px] font-medium ${isLight ? "text-gray-500" : "text-[#8B98A8]"}`}>{label}</span>
      <div className="max-w-[88%] px-3.5 py-2.5 text-[13.5px] leading-relaxed text-black" style={{ background: "var(--accent-paint)" }}>
        {children}
      </div>
    </div>
  );
}

export function AIBubble({ children, label = "Assistant", footer, isLight }) {
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="text-[11px] font-medium text-(--accent-readable)">{label}</span>
      <div className={`max-w-[94%] border px-3.5 py-2.5 text-[13.5px] leading-relaxed ${isLight ? "border-[#E5E4E7] bg-white text-gray-900" : "border-[#263241] bg-gray-950 text-[#D6DEE8]"}`}>
        {children}
      </div>
      {footer && <span className={`text-[11px] ${isLight ? "text-gray-500" : "text-[#8B98A8]"}`}>{footer}</span>}
    </div>
  );
}
