import { useState } from "react";

const SendIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></svg>
);

// Message box: Enter sends, Shift+Enter adds a line. onNewThread (optional) adds a "New chat" button.
export default function ChatInput({ onSubmit, disabled, onNewThread, placeholder = "Type a message…", isLight }) {
  const [text, setText] = useState("");
  const send = () => {
    const value = text.trim();
    if (!value || disabled) return;
    onSubmit(value);
    setText("");
  };
  const muted = isLight ? "text-gray-500" : "text-[#8B98A8]";
  return (
    <div>
      <div className={`flex items-end gap-2 border px-3 py-2 transition-colors focus-within:border-(--accent-color) ${isLight ? "border-[#E5E4E7] bg-white" : "border-[#263241] bg-black"}`}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder={placeholder}
          aria-label="Message"
          className={`max-h-32 min-h-6 flex-1 resize-none border-0 bg-transparent py-0.5 text-[13.5px] outline-none ${isLight ? "placeholder:text-gray-400" : "placeholder:text-[#566273]"}`}
        />
        <button
          type="button"
          onClick={send}
          disabled={!text.trim() || disabled}
          aria-label="Send message"
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center border-0 text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: "var(--accent-paint)" }}
        >
          <SendIcon />
        </button>
      </div>
      <div className={`mt-1.5 flex items-center justify-between gap-3 text-[11.5px] ${muted}`}>
        <span>Enter to send · Shift+Enter for a new line</span>
        {onNewThread && (
          <button type="button" onClick={onNewThread} className="cursor-pointer border-0 bg-transparent p-0 text-[12px] font-medium text-(--accent-readable) hover:underline">
            New chat
          </button>
        )}
      </div>
    </div>
  );
}
