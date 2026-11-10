import { useEffect, useRef, useState } from "react";
import { useTheme } from "../../context/ThemeContext";

const initialMessages = [
  { role: "ai", text: "Hello! I'm your AIVERSE Copilot. I can help you build workflows, connect LLMs and configure AI agents." },
  { role: "user", text: "Help me create an AI workflow." },
  { role: "ai", text: "Sure! To create a workflow, start by defining your trigger — an event or API call. Then chain LLM nodes, tool calls, and conditional branches. Want me to scaffold a template?" },
];

const suggestions = ["+ Build Workflow", "+ Connect LLM", "+ Create Agent", "+ Configure RAG", "+ Setup MCP"];

const SparkleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
  </svg>
);
const SparkleIconTiny = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
  </svg>
);
const ThemeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);
const CollapseIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const SendIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#070A0F" strokeWidth="2.5">
    <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
  </svg>
);

// The copilot is a sidebar that only exists while the floating chatbot button has opened it. From md up it is a real
// layout column (the page makes room for it); on phones there is no room beside the page, so it slides over it instead.
export default function RightSidebar({ open = false, onClose }) {
  const theme = useTheme();
  const isLight = theme.rightSidebarTheme === "light";
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "Processing your request through the AIVERSE neural engine. I'll help you configure that component right away." },
      ]);
    }, 1100 + Math.random() * 700);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <aside
      aria-hidden={!open}
      inert={!open}
      className={`fixed inset-y-0 right-0 z-40 h-full w-[92vw] max-w-85 shrink-0 overflow-hidden transition-all duration-300 ease-out md:static md:z-auto md:max-w-none ${
        open ? "translate-x-0 border-l shadow-2xl md:w-85 md:shadow-none" : "invisible translate-x-full md:visible md:w-0 md:translate-x-0"
      } ${
        isLight ? "bg-white border-[#E5E4E7]" : "bg-linear-to-b from-[#030712] to-black border-[#263241]/60"
      }`}
    >
      {/* Fixed-width inner column so the text does not reflow while the sidebar animates open */}
      <div className="flex h-full w-85 max-w-[92vw] flex-col">
      {/* Header */}
      <div className={`flex items-center gap-3 px-4 py-4 border-b shrink-0 ${isLight ? "border-[#E5E4E7]" : "border-[#263241]/60"}`}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-(--accent-soft) border border-(--accent-border)">
          <span className="text-(--accent-readable)"><SparkleIcon /></span>
        </div>

        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold tracking-wider ${isLight ? "text-gray-900" : "text-white"}`}>
            AIVERSE COPILOT
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => theme.setRightSidebarTheme(isLight ? "dark" : "light")}
            title="Toggle theme"
            aria-label="Toggle right sidebar theme"
            className={`flex items-center justify-center w-7 h-7 rounded cursor-pointer border-0 transition-colors bg-transparent ${
              isLight ? "text-gray-500 hover:bg-black/4" : "text-[#566273] hover:bg-white/5"
            }`}
          >
            <ThemeIcon />
          </button>
          <button
            onClick={() => onClose?.()}
            title="Close"
            aria-label="Close copilot"
            className={`flex items-center justify-center w-7 h-7 rounded cursor-pointer border-0 transition-colors bg-transparent ${
              isLight ? "text-gray-500 hover:bg-black/4" : "text-[#566273] hover:bg-white/5"
            }`}
          >
            <CollapseIcon />
          </button>
        </div>
      </div>

      {/* Subtitle */}
      <div className={`px-4 py-2 border-b shrink-0 ${isLight ? "border-[#E5E4E7]" : "border-[#1A2535]"}`}>
        <span className={`text-xs ${isLight ? "text-gray-500" : "text-[#566273]"}`}>Contextual AI Assistant</span>
      </div>

      {/* Chat area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollable px-4 py-4 flex flex-col gap-4">
        {messages.map((msg, i) =>
          msg.role === "ai" ? (
            <div key={i} className="flex items-start gap-2.5">
              <div className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center mt-0.5 bg-(--accent-soft) border border-(--accent-border)">
                <span className="text-(--accent-readable)"><SparkleIconTiny /></span>
              </div>
              <div className="flex flex-col gap-1 items-start max-w-[85%]">
                <span className="text-xs font-medium text-(--accent-readable)">AIVERSE</span>
                <div
                  className={`rounded-xl rounded-tl-sm px-3 py-2.5 text-sm leading-relaxed border ${
                    isLight ? "bg-[#F4F7FA] border-[#E5E4E7] text-gray-900" : "bg-[#0D1420] border-[#1E2D3D] text-[#B8C4D0]"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          ) : (
            <div key={i} className="flex flex-col gap-1 items-end">
              <span className={`text-xs font-medium ${isLight ? "text-gray-500" : "text-[#566273]"}`}>YOU</span>
              <div
                className="rounded-xl rounded-tr-sm px-3 py-2.5 text-sm leading-relaxed max-w-[85%] text-white"
                style={{ background: "var(--accent-paint)" }}
              >
                {msg.text}
              </div>
            </div>
          )
        )}
        {typing && (
          <div className="flex items-start gap-2.5">
            <div className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center mt-0.5 bg-(--accent-soft) border border-(--accent-border)">
              <span className="text-(--accent-readable)"><SparkleIconTiny /></span>
            </div>
            <div className="flex flex-col gap-1 items-start">
              <span className="text-xs font-medium text-(--accent-readable)">AIVERSE</span>
              <div
                className={`rounded-xl rounded-tl-sm px-3.5 py-3 border flex items-center gap-1 ${
                  isLight ? "bg-[#F4F7FA] border-[#E5E4E7]" : "bg-[#0D1420] border-[#1E2D3D]"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-(--accent-readable) animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-(--accent-readable) animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-(--accent-readable) animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      <div className={`px-4 py-3 border-t flex flex-wrap gap-2 shrink-0 ${isLight ? "border-[#E5E4E7]" : "border-[#1A2535]"}`}>
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => setInput(s.replace("+ ", ""))}
            className={`px-2.5 py-1 rounded-full border text-xs cursor-pointer transition-colors ${
              isLight
                ? "bg-black/3 border-[#E5E4E7] text-gray-600 hover:border-(--accent-border) hover:text-(--accent-readable)"
                : "bg-[#263241]/40 border-[#263241] text-[#8B98A8] hover:border-(--accent-border) hover:text-(--accent-readable)"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className={`px-4 py-4 border-t shrink-0 ${isLight ? "border-[#E5E4E7]" : "border-[#263241]/60"}`}>
        <div
          className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border transition-all ${
            isLight ? "bg-[#F4F7FA]" : "bg-[#030712]"
          } ${focused ? "border-(--accent-border) shadow-[0_0_12px_var(--accent-soft)]" : isLight ? "border-[#E5E4E7]" : "border-[#263241]"}`}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Ask AIVERSE anything..."
            className={`flex-1 bg-transparent border-0 outline-none text-sm caret-(--accent-readable) ${isLight ? "text-gray-900" : "text-white"}`}
          />
          <button
            onClick={sendMessage}
            aria-label="Send message"
            className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer shrink-0 transition-opacity ${
              input.trim() ? "opacity-100" : "opacity-40"
            }`}
            style={{ background: "var(--accent-paint)" }}
          >
            <SendIcon />
          </button>
        </div>
        <div className="flex items-center justify-between mt-2 px-1">
          <span className={`text-xs ${isLight ? "text-gray-500" : "text-[#566273]"}`}>ENTER to send</span>
          <span className={`text-xs ${isLight ? "text-gray-500" : "text-[#566273]"}`}>GPT-4o · v2.1</span>
        </div>
      </div>
      </div>
    </aside>
  );
}
