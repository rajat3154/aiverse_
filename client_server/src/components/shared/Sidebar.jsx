import { useRef, useState } from "react";
import { useTheme } from "../../context/ThemeContext";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import SettingsPanel from "./SettingsPanel";

const Icon = ({ size = 15, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    {children}
  </svg>
);

const HomeIcon = () => (
  <Icon><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></Icon>
);
const LLMIcon = () => (
  <Icon><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></Icon>
);
const ToolsIcon = () => (
  <Icon><path d="M14.7 6.3a4 4 0 005.4 5.4l-9.4 9.4a2.1 2.1 0 01-3-3l9.4-9.4a4 4 0 00-2.4-2.4z" /></Icon>
);
const AgentIcon = () => (
  <Icon>
    <rect x="4" y="8" width="16" height="12" rx="2" /><path d="M12 8V4" /><circle cx="12" cy="3" r="1" /><circle cx="9" cy="14" r="1" /><circle cx="15" cy="14" r="1" />
  </Icon>
);
const PromptsIcon = () => (
  <Icon><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /><line x1="8" y1="9" x2="16" y2="9" /><line x1="8" y1="13" x2="13" y2="13" /></Icon>
);
const WorkflowsIcon = () => (
  <Icon>
    <rect x="3" y="3" width="6" height="6" rx="1" /><rect x="15" y="15" width="6" height="6" rx="1" /><rect x="15" y="3" width="6" height="6" rx="1" /><path d="M9 6h6M18 9v6M6 9v3a3 3 0 003 3h6" />
  </Icon>
);
const LensIcon = () => (
  <Icon><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></Icon>
);
const SettingsIconSmall = () => (
  <Icon size={14}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </Icon>
);

const ChevronIcon = ({ open }) => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={`shrink-0 transition-transform duration-200 ${open ? "rotate-90" : ""}`}
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

// Static navigation: items only switch the highlighted entry, there is no routing.
const navGroups = [
  {
    title: "AI SYSTEMS",
    items: [
      { id: "home", label: "Home", icon: <HomeIcon /> },
      { id: "llm", label: "LLM", icon: <LLMIcon />, children: [{ id: "llm-models", label: "Models" }] },
      {
        id: "tools", label: "Tools", icon: <ToolsIcon />,
        children: [
          { id: "tools-composio", label: "Composio" },
          { id: "tools-mcp-toolbox", label: "MCP Toolbox" },
        ],
      },
      { id: "prompts", label: "Prompts", icon: <PromptsIcon /> },
      { id: "agents", label: "Agents", icon: <AgentIcon /> },
      { id: "workflows", label: "Workflows", icon: <WorkflowsIcon /> },
      { id: "lens", label: "Lens", icon: <LensIcon /> },
    ],
  },
];

// Below md the sidebar is an off-canvas drawer (mobileOpen); from md up it sits in the layout and can collapse to icons.
export default function Sidebar({ mobileOpen = false, onMobileClose }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [collapsedPreference, setCollapsed] = useState(false);
  const collapsed = collapsedPreference && isDesktop;
  const [activeItem, setActiveItem] = useState("home");
  const [hoveredItem, setHoveredItem] = useState(null);
  const [expandedItem, setExpandedItem] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsTriggerRef = useRef(null);

  const isLight = theme.leftSidebarTheme === "light";

  const toggleExpanded = (id) => setExpandedItem((current) => (current === id ? null : id));

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 md:relative md:inset-auto md:z-auto shrink-0 flex flex-col h-full border-r transition-all duration-300 ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } md:translate-x-0 ${collapsed ? "w-16" : "w-68 max-w-[85vw] md:max-w-none"} ${isLight ? "bg-white border-[#E5E4E7]" : "bg-linear-to-b from-[#030712] to-black border-[#263241]/60"}`}
    >
      <button
        type="button"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={() => setCollapsed((v) => !v)}
        className={`absolute -right-3 top-5 z-20 hidden md:flex items-center justify-center w-6 h-6 rounded-full border cursor-pointer transition-colors ${
          isLight
            ? "bg-white border-[#E5E4E7] text-gray-500 hover:bg-black/4"
            : "bg-[#0B0F17] border-[#263241] text-[#566273] hover:bg-white/5"
        }`}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={`transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>

      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-4 border-b shrink-0 ${isLight ? "border-[#E5E4E7]" : "border-[#263241]/60"}`}>
        <div className="relative shrink-0 w-8 h-8 flex items-center justify-center">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="1" y="1" width="30" height="30" rx="6" fill="#030712" stroke="#263241" strokeWidth="1" />
            <circle cx="16" cy="16" r="3" fill="var(--accent-color)" opacity="0.9" />
            <circle cx="8" cy="8" r="1.5" fill="#00D9FF" opacity="0.6" />
            <circle cx="24" cy="8" r="1.5" fill="#00D9FF" opacity="0.6" />
            <circle cx="8" cy="24" r="1.5" fill="#00D9FF" opacity="0.6" />
            <circle cx="24" cy="24" r="1.5" fill="#00D9FF" opacity="0.6" />
            <line x1="8" y1="8" x2="13" y2="13" stroke="#263241" strokeWidth="1" />
            <line x1="24" y1="8" x2="19" y2="13" stroke="#263241" strokeWidth="1" />
            <line x1="8" y1="24" x2="13" y2="19" stroke="#263241" strokeWidth="1" />
            <line x1="24" y1="24" x2="19" y2="19" stroke="#263241" strokeWidth="1" />
            <line x1="16" y1="4" x2="16" y2="13" stroke="var(--accent-color)" strokeWidth="1" opacity="0.4" />
            <line x1="16" y1="19" x2="16" y2="28" stroke="var(--accent-color)" strokeWidth="1" opacity="0.4" />
            <line x1="4" y1="16" x2="13" y2="16" stroke="var(--accent-color)" strokeWidth="1" opacity="0.4" />
            <line x1="19" y1="16" x2="28" y2="16" stroke="var(--accent-color)" strokeWidth="1" opacity="0.4" />
          </svg>
        </div>

        {!collapsed && (
          <div className="flex items-baseline gap-0.5 font-sans">
            <span className={`text-lg font-bold tracking-wider ${isLight ? "text-gray-900" : "text-white"}`}>AI</span>
            <span
              className="text-lg font-bold tracking-wider bg-clip-text text-transparent"
              style={{ backgroundImage: "var(--accent-paint)" }}
            >
              VERSE
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 scrollable">
        {navGroups.map((group) => (
          <div key={group.title} className="mb-4">
            {!collapsed && (
              <div className={`px-4 pb-1 pt-2 text-xs tracking-widest font-medium ${isLight ? "text-gray-500" : "text-[#566273]"}`}>
                {group.title}
              </div>
            )}
            {group.items.map((item) => {
              const hasChildren = item.children?.length > 0;
              const isExpanded = expandedItem === item.id;
              const isActive = activeItem === item.id || item.children?.some((child) => child.id === activeItem);
              const isHovered = hoveredItem === item.id;

              const handleClick = () => {
                if (hasChildren) {
                  if (!collapsed) toggleExpanded(item.id);
                } else {
                  setActiveItem(item.id);
                  onMobileClose?.();
                }
              };

              return (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={handleClick}
                    onMouseEnter={() => setHoveredItem(item.id)}
                    onMouseLeave={() => setHoveredItem(null)}
                    className={`relative flex items-center gap-3 rounded-lg mx-2 my-px cursor-pointer border-0 bg-transparent transition-colors duration-150 w-[calc(100%-16px)] ${
                      collapsed ? "py-2.5 px-0 justify-center" : "py-2.5 px-4 justify-start"
                    } ${
                      isActive
                        ? isLight ? "bg-black/4 text-gray-900" : "text-white"
                        : isHovered
                        ? isLight ? "bg-black/3 text-gray-900" : "bg-white/3 text-white"
                        : isLight ? "text-gray-600" : "text-[#8B98A8]"
                    }`}
                    style={isActive && !isLight ? { background: "color-mix(in srgb, var(--accent-color) 6%, transparent)" } : undefined}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r" style={{ backgroundImage: "var(--accent-paint)" }} />
                    )}
                    <span style={{ color: isActive || isHovered ? "var(--accent-color)" : isLight ? "#64748B" : "#566273" }}>
                      {item.icon}
                    </span>
                    {!collapsed && <span className="text-sm font-medium flex-1 text-left">{item.label}</span>}
                    {!collapsed && hasChildren && <ChevronIcon open={isExpanded} />}
                  </button>

                  {!collapsed && hasChildren && (
                    <div
                      className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                        isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className={`ml-6.5 mr-2 mt-1 mb-2 pl-4 border-l flex flex-col gap-1 ${isLight ? "border-[#E5E4E7]" : "border-[#263241]/60"}`}>
                          {item.children.map((child, index) => {
                            const isChildActive = activeItem === child.id;
                            return (
                              <button
                                key={child.id}
                                type="button"
                                onClick={() => { setActiveItem(child.id); onMobileClose?.(); }}
                                className={`text-left text-sm rounded-md px-3 py-2 cursor-pointer border-0 bg-transparent transition-all duration-200 ${
                                  isExpanded ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
                                } ${
                                  isChildActive
                                    ? ""
                                    : isLight
                                    ? "text-gray-600 hover:text-gray-900 hover:bg-black/4 hover:translate-x-0.5"
                                    : "text-[#8B98A8] hover:text-white hover:bg-white/4 hover:translate-x-0.5"
                                }`}
                                style={{
                                  transitionDelay: isExpanded ? `${index * 30}ms` : "0ms",
                                  ...(isChildActive ? { color: "var(--accent-color)", background: "color-mix(in srgb, var(--accent-color) 8%, transparent)" } : {}),
                                }}
                              >
                                {child.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>

      {/* TEMPORARY: shortcut to the signup page, remove once real auth navigation exists */}
      <a
        href="/signup"
        className={`flex items-center gap-3 px-4 py-3 border-t text-[13px] font-medium transition-colors no-underline ${
          collapsed ? "justify-center px-0" : ""
        } ${isLight ? "border-[#E5E4E7] text-gray-600 hover:bg-black/3" : "border-[#263241]/60 text-[#8B98A8] hover:bg-white/3"}`}
      >
        <Icon size={14}>
          <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M19 8v6M22 11h-6" />
        </Icon>
        {!collapsed && "Sign up"}
      </a>

      {/* Theme settings */}
      <div className={`relative border-t ${isLight ? "border-[#E5E4E7]" : "border-[#263241]/60"}`}>
        <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} anchor={isDesktop ? "left" : "above"}triggerRef={settingsTriggerRef} />
        <button
          ref={settingsTriggerRef}
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          className={`flex items-center gap-3 w-full px-4 py-3 cursor-pointer border-0 bg-transparent text-[13px] font-medium transition-colors ${
            collapsed ? "justify-center px-0" : ""
          } ${isLight ? "text-gray-600 hover:bg-black/3" : "text-[#8B98A8] hover:bg-white/3"}`}
        >
          <SettingsIconSmall />
          {!collapsed && "Settings"}
        </button>
      </div>
    </aside>
  );
}
