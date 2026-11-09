import { useTheme } from "../../context/ThemeContext";

const highlights = [
  {
    title: "Workflows",
    color: "#F59E0B",
    tags: ["Automation", "Triggers"],
    description: "Chain triggers, LLM calls, tools and branches into reliable, repeatable flows.",
    icon: <path d="M3 3h6v6H3zM15 3h6v6h-6zM15 15h6v6h-6zM9 6h6M18 9v6M6 9v3a3 3 0 003 3h6" />,
  },
  {
    title: "AI Agents",
    color: "#6366F1",
    tags: ["Memory", "Tools"],
    description: "Agents with their own instructions, memory and tools that work on your behalf.",
    icon: <path d="M6 8h12a2 2 0 012 2v8a2 2 0 01-2 2H6a2 2 0 01-2-2v-8a2 2 0 012-2zM12 8V4M9 14h.01M15 14h.01" />,
  },
  {
    title: "Any LLM provider",
    color: "#10B981",
    tags: ["OpenAI", "Anthropic"],
    description: "OpenAI, Anthropic, Google and open models — switch without changing your flows.",
    icon: <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />,
  },
  {
    title: "Tools & MCP",
    color: "#0EA5E9",
    tags: ["Composio", "MCP"],
    description: "Connect apps and data through Composio integrations and MCP servers.",
    icon: <path d="M14.7 6.3a4 4 0 005.4 5.4l-9.4 9.4a2.1 2.1 0 01-3-3l9.4-9.4a4 4 0 00-2.4-2.4z" />,
  },
];

// One feature as a plain card.
const FeatureCard = ({ h, i, light }) => (
  <li
    className={`node-in group flex flex-col border p-5 transition ${
      light ? "border-[#E5E4E7] bg-white" : "border-[#263241] bg-linear-to-br from-[#101826] to-[#06090F]"
    } duration-300 hover:-translate-y-0.5 hover:border-(--c) hover:shadow-[0_10px_30px_-10px_var(--c)]`}
    style={{ animationDelay: `${i * 90}ms`, "--c": h.color }}
  >
    <span
      className="flex h-10 w-10 items-center justify-center text-white"
      style={{ backgroundImage: `linear-gradient(135deg, ${h.color}, ${h.color}99)`, boxShadow: `0 6px 16px -6px ${h.color}` }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {h.icon}
      </svg>
    </span>
    <p className={`mt-4 text-sm font-semibold ${light ? "text-gray-900" : "text-white"}`}>{h.title}</p>
    <p className={`mt-1.5 text-xs leading-relaxed ${light ? "text-gray-600" : "text-[#8FA0B3]"}`}>{h.description}</p>
  </li>
);

const ThemeToggle = ({ light, onToggle }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={light ? "Switch to dark theme" : "Switch to light theme"}
    title={light ? "Switch to dark theme" : "Switch to light theme"}
    className={`absolute right-4 top-4 flex h-9 w-9 cursor-pointer items-center justify-center border bg-transparent transition hover:border-(--accent-color) hover:text-(--accent-readable) ${
      light ? "border-[#E5E4E7] text-gray-700" : "border-[#263241] text-[#B8C4D0]"
    }`}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {light ? (
        <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
      ) : (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </>
      )}
    </svg>
  </button>
);

// Shared two-column shell for the login and signup pages: platform info on the left, the form (children) on the right.
const AuthLayout = ({ children }) => {
  const theme = useTheme();
  const leftLight = theme.leftSidebarTheme === "light";
  const light = theme.mainSectionTheme === "light";
  // One switch for the whole page: both sides follow it, like the theme settings in the app sidebar.
  const toggleTheme = () => {
    const next = light ? "dark" : "light";
    theme.setMainSectionTheme(next);
    theme.setLeftSidebarTheme(next);
  };

  return (
    <div className="flex min-h-dvh w-full">
      {/* Left: platform information */}
      <aside
        className={`relative hidden w-1/2 max-w-[720px] flex-col overflow-hidden border-r p-12 lg:flex ${
          leftLight ? "border-[#E5E4E7] bg-white text-gray-900" : "border-[#263241]/60 bg-linear-to-b from-[#030712] to-black text-white"
        }`}
      >
        <div className="relative flex items-baseline gap-0.5 text-2xl">
          <span className="font-bold tracking-wider">AI</span>
          <span className="font-bold tracking-wider bg-clip-text text-transparent" style={{ backgroundImage: "var(--accent-paint)" }}>
            VERSE
          </span>
        </div>

        <div className="relative my-auto py-10">
          <h1 className="text-4xl font-bold leading-tight">
            Build, connect and run{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--accent-paint)" }}>
              AI agents
            </span>{" "}
            in one place.
          </h1>
          <p className={`mt-4 max-w-md ${leftLight ? "text-gray-600" : "text-[#B8C4D0]"}`}>
            AIVerse is a workspace for orchestrating LLMs, tools and workflows — from first prototype to always-on automation.
          </p>

          <ul className="mt-10 grid grid-cols-2 auto-rows-fr gap-4">
            {highlights.map((h, i) => (
              <FeatureCard key={h.title} h={h} i={i} light={leftLight} />
            ))}
          </ul>
        </div>
      </aside>

      {/* Right: form */}
      <main
        className={`relative flex flex-1 items-center justify-center overflow-y-auto px-4 pb-10 pt-16 sm:px-8 lg:py-10 ${
          light ? "bg-[#F4F7FA] text-gray-900" : "bg-black text-white"
        }`}
      >
        <ThemeToggle light={light} onToggle={toggleTheme} />
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-baseline gap-0.5 text-xl">
              <span className="font-bold tracking-wider">AI</span>
              <span className="font-bold tracking-wider bg-clip-text text-transparent" style={{ backgroundImage: "var(--accent-paint)" }}>
                VERSE
              </span>
            </div>
            <p className={`mt-2 text-sm ${light ? "text-gray-600" : "text-[#8FA0B3]"}`}>
              Build, connect and run AI agents, LLM workflows and tools in one place.
            </p>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
};

export default AuthLayout;
