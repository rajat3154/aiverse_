export default function TypingIndicator({ label = "Assistant", isLight }) {
  return (
    <div className="flex flex-col items-start gap-1" role="status" aria-label={`${label} is typing`}>
      <span className="text-[11px] font-medium text-(--accent-readable)">{label}</span>
      <div className={`flex items-center gap-1 border px-3.5 py-3 ${isLight ? "border-[#E5E4E7] bg-white" : "border-[#263241] bg-gray-950"}`}>
        {[0, 150, 300].map((delay) => (
          <span key={delay} className="h-1.5 w-1.5 animate-bounce rounded-full bg-(--accent-readable)" style={{ animationDelay: `${delay}ms` }} />
        ))}
      </div>
    </div>
  );
}
