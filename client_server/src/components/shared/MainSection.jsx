import { useTheme } from "../../context/ThemeContext";

const stats = [
  { value: "50+", label: "LLM models" },
  { value: "1,000+", label: "Tool integrations" },
  { value: "24/7", label: "Agent uptime" },
  { value: "<200ms", label: "Orchestration latency" },
];

const features = [
  {
    title: "Workflows",
    description: "Chain triggers, LLM calls, tools and conditional branches into reliable, repeatable flows.",
    icon: <path d="M3 3h6v6H3zM15 3h6v6h-6zM15 15h6v6h-6zM9 6h6M18 9v6M6 9v3a3 3 0 003 3h6" />,
  },
  {
    title: "AI Agents",
    description: "Create agents with their own instructions, memory and tools, then let them work on your behalf.",
    icon: <path d="M6 8h12a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8a2 2 0 012-2zM12 8V4M9 14h.01M15 14h.01" />,
  },
  {
    title: "LLM Providers",
    description: "Connect OpenAI, Anthropic, Google and open models, and switch between them without changing your flows.",
    icon: <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />,
  },
  {
    title: "Tools & MCP",
    description: "Give agents access to apps and data through Composio integrations and Model Context Protocol servers.",
    icon: <path d="M14.7 6.3a4 4 0 005.4 5.4l-9.4 9.4a2.1 2.1 0 01-3-3l9.4-9.4a4 4 0 00-2.4-2.4z" />,
  },
  {
    title: "Prompts",
    description: "Write, version and reuse prompt templates across every agent and workflow.",
    icon: <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2zM8 9h8M8 13h5" />,
  },
  {
    title: "Lens",
    description: "Trace every run, inspect inputs and outputs, and see exactly where a workflow slowed down or failed.",
    icon: <path d="M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.35-4.35" />,
  },
];

const steps = [
  { title: "Connect", description: "Add your LLM providers and tools." },
  { title: "Build", description: "Design agents and workflows visually." },
  { title: "Run", description: "Trigger by event, API call or schedule." },
  { title: "Observe", description: "Trace runs and improve with Lens." },
];

const quickStarts = ["Build a workflow", "Create an agent", "Connect an LLM", "Browse tools"];

export default function MainSection() {
  const theme = useTheme();
  const isLight = theme.mainSectionTheme === "light";

  const muted = isLight ? "text-gray-600" : "text-[#8B98A8]";
  const subtle = isLight ? "text-gray-500" : "text-[#566273]";
  const card = isLight ? "bg-white border-[#E5E4E7]" : "bg-gray-950 border-[#263241]";

  return (
    <main
      className={`flex-1 min-h-0 overflow-y-auto scrollable px-4 sm:px-8 py-8 sm:py-12 ${
        isLight ? "bg-[#F4F7FA] text-gray-900" : "bg-gray-950 text-white"
      }`}
    >
      <div className="mx-auto w-full max-w-4xl flex flex-col gap-10 sm:gap-14">
        {/* Hero */}
        <section className="text-center flex flex-col items-center gap-6">
          <span className="px-3 py-1 rounded-full border text-xs tracking-widest bg-(--accent-soft) border-(--accent-border) text-(--accent-readable)">
            AI WORKFLOW PLATFORM
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-wider">
            <span>AI</span>
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--accent-paint)" }}>
              VERSE
            </span>
          </h1>
          <p className={`max-w-xl text-sm sm:text-base leading-relaxed ${muted}`}>
            Build workflows, connect LLMs and tools, and configure AI agents in one place — from first prototype to production.
          </p>
          <div className="flex flex-col sm:flex-row w-full sm:w-auto justify-center gap-3">
            <button
              type="button"
              className="px-6 py-3 rounded-lg text-sm font-semibold text-[#070A0F] cursor-pointer border-0 w-full sm:w-auto"
              style={{ background: "var(--accent-paint)" }}
            >
              Get started
            </button>
            <button
              type="button"
              className={`px-6 py-3 w-full sm:w-auto rounded-lg text-sm font-semibold cursor-pointer border transition-colors bg-transparent hover:border-(--accent-border) hover:text-(--accent-readable) ${
                isLight ? "border-[#E5E4E7] text-gray-700" : "border-[#263241] text-[#B8C4D0]"
              }`}
            >
              View documentation
            </button>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {quickStarts.map((label) => (
              <span
                key={label}
                className={`px-3 py-1 rounded-full border text-xs ${
                  isLight ? "bg-black/3 border-[#E5E4E7] text-gray-600" : "bg-[#263241]/40 border-[#263241] text-[#8B98A8]"
                }`}
              >
                + {label}
              </span>
            ))}
          </div>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map(({ value, label }) => (
            <div key={label} className={`rounded-xl border p-4 text-center ${card}`}>
              <div className="text-xl sm:text-2xl font-bold bg-clip-text text-transparent" style={{ backgroundImage: "var(--accent-paint)" }}>
                {value}
              </div>
              <div className={`mt-1 text-xs ${subtle}`}>{label}</div>
            </div>
          ))}
        </section>

        {/* Features */}
        <section className="flex flex-col gap-4">
          <h2 className={`text-xs tracking-widest font-medium ${subtle}`}>EVERYTHING YOU NEED</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map(({ title, description, icon }) => (
              <div
                key={title}
                className={`rounded-xl border p-5 flex flex-col gap-3 transition-colors hover:border-(--accent-border) ${card}`}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-(--accent-soft) border border-(--accent-border) text-(--accent-readable)">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    {icon}
                  </svg>
                </div>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className={`text-sm leading-relaxed ${muted}`}>{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="flex flex-col gap-4">
          <h2 className={`text-xs tracking-widest font-medium ${subtle}`}>HOW IT WORKS</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {steps.map(({ title, description }, index) => (
              <div key={title} className={`rounded-xl border p-5 ${card}`}>
                <div className="text-xs font-semibold text-(--accent-readable)">{String(index + 1).padStart(2, "0")}</div>
                <h3 className="mt-2 text-sm font-semibold">{title}</h3>
                <p className={`mt-1 text-sm leading-relaxed ${muted}`}>{description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
