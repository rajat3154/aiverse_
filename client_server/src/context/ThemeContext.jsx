import { createContext, useContext, useEffect, useMemo, useState } from "react";

export const ACCENT_COLORS = [
  { label: "Neon green", value: "#39FF88" },
  { label: "Cyan", value: "#00D9FF" },
  { label: "Violet", value: "#8B5CF6" },
  { label: "Amber", value: "#FBBF24" },
  { label: "Pink", value: "#F472B6" },
  { label: "Blue", value: "#3B82F6" },
];

const STORAGE_KEY = "aiverse.theme";

const DEFAULTS = {
  leftSidebarTheme: "dark",
  rightSidebarTheme: "dark",
  mainSectionTheme: "dark",
  accentColor: ACCENT_COLORS[0].value,
  accentColorB: ACCENT_COLORS[1].value,
  accentMode: "color",
  gradientAngle: 135,
};

const load = () => {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
};

const hexToRgb = (hex) => {
  const value = hex.replace("#", "");
  if (!/^[0-9A-Fa-f]{6}$/.test(value)) return { r: 57, g: 255, b: 136 };
  return { r: parseInt(value.slice(0, 2), 16), g: parseInt(value.slice(2, 4), 16), b: parseInt(value.slice(4, 6), 16) };
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [state, setState] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable: theme just won't persist
    }
    const { r, g, b } = hexToRgb(state.accentColor);
    const root = document.documentElement.style;
    root.setProperty("--accent-color", state.accentColor);
    root.setProperty(
      "--accent-paint",
      state.accentMode === "gradient"
        ? `linear-gradient(${state.gradientAngle}deg, ${state.accentColor}, ${state.accentColorB})`
        : `linear-gradient(${state.accentColor}, ${state.accentColor})`
    );
    root.setProperty("--accent-soft", `rgba(${r}, ${g}, ${b}, 0.12)`);
    root.setProperty("--accent-border", `rgba(${r}, ${g}, ${b}, 0.4)`);
    root.setProperty("--accent-readable", state.accentColor);
  }, [state]);

  const value = useMemo(() => {
    const set = (key) => (next) => setState((current) => ({ ...current, [key]: next }));
    return {
      ...state,
      setLeftSidebarTheme: set("leftSidebarTheme"),
      setRightSidebarTheme: set("rightSidebarTheme"),
      setMainSectionTheme: set("mainSectionTheme"),
      setAccentColor: set("accentColor"),
      setAccentColorB: set("accentColorB"),
      setAccentMode: set("accentMode"),
      setGradientAngle: set("gradientAngle"),
    };
  }, [state]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
};
