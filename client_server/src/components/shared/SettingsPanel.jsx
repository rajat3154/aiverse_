import { useEffect, useRef, useState } from "react";
import { ACCENT_COLORS, useTheme } from "../../context/ThemeContext";

const hexToRgb = (hex) => {
  const value = hex.replace("#", "");
  return /^[0-9A-Fa-f]{6}$/.test(value)
    ? { r: parseInt(value.slice(0, 2), 16), g: parseInt(value.slice(2, 4), 16), b: parseInt(value.slice(4, 6), 16) }
    : null;
};
const rgbToHex = ({ r, g, b }) => `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
function rgbToHsv({ r, g, b }) {
  const red = r / 255, green = g / 255, blue = b / 255, max = Math.max(red, green, blue), min = Math.min(red, green, blue), delta = max - min;
  let h = 0;
  if (delta) h = 60 * (max === red ? ((green - blue) / delta) % 6 : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4);
  return { h: h < 0 ? h + 360 : h, s: max ? delta / max : 0, v: max };
}
function hsvToRgb({ h, s, v }) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const values = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return { r: Math.round((values[0] + m) * 255), g: Math.round((values[1] + m) * 255), b: Math.round((values[2] + m) * 255) };
}

function MiniColorPicker({ color, onChange, label, isLight }) {
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState(() => rgbToHsv(hexToRgb(color) ?? { r: 57, g: 255, b: 136 }));
  const rgb = hsvToRgb(hsv);
  const currentColor = rgbToHex(rgb);
  const hueColor = rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }));

  useEffect(() => {
    const parsed = hexToRgb(color);
    if (parsed) setHsv(rgbToHsv(parsed));
  }, [color]);

  const apply = (next) => {
    setHsv(next);
    onChange(rgbToHex(hsvToRgb(next)));
  };
  const pickSV = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    apply({
      ...hsv,
      s: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      v: Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height)),
    });
  };
  const pickHue = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    apply({ ...hsv, h: Math.max(0, Math.min(360, ((event.clientY - rect.top) / rect.height) * 360)) });
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Open ${label} color picker`}
        onClick={() => setOpen((v) => !v)}
        className="w-5 h-5 rounded-full cursor-pointer border-2 border-white/20 shrink-0"
        style={{ background: color }}
      />
      {open && (
        <div
          className={`absolute z-10 top-full left-0 mt-2 p-2.5 rounded-lg border ${isLight ? "bg-[#F4F7FA] border-[#E5E4E7]" : "bg-[#030712] border-[#263241]"}`}
          style={{ width: "160px" }}
        >
          <div className="flex gap-1.5">
            <div
              onPointerDown={pickSV}
              onPointerMove={(e) => { if (e.buttons) pickSV(e); }}
              className="relative h-20 flex-1 rounded cursor-crosshair"
              style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})` }}
            >
              <span
                className="absolute w-2.5 h-2.5 rounded-full border-2 border-white pointer-events-none"
                style={{ left: `calc(${hsv.s * 100}% - 5px)`, top: `calc(${(1 - hsv.v) * 100}% - 5px)` }}
              />
            </div>
            <div
              onPointerDown={pickHue}
              onPointerMove={(e) => { if (e.buttons) pickHue(e); }}
              className="relative w-2.5 h-20 rounded cursor-pointer"
              style={{ background: "linear-gradient(to bottom, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
            >
              <span
                className="absolute -left-0.5 w-3.5 h-1 border border-white pointer-events-none"
                style={{ top: `calc(${(hsv.h / 360) * 100}% - 2px)` }}
              />
            </div>
          </div>
          <div className={`mt-2 text-center text-[10px] ${isLight ? "text-gray-600" : "text-[#8B98A8]"}`}>{currentColor}</div>
        </div>
      )}
    </div>
  );
}

function MiniThemeToggle({ label, value, onChange, isLight }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-[11px] ${isLight ? "text-gray-600" : "text-[#8B98A8]"}`}>{label}</span>
      <div className={`flex p-0.5 rounded-md border ${isLight ? "bg-black/4 border-black/10" : "bg-[#111827] border-[#1E2D3D]"}`}>
        {["light", "dark"].map((t) => (
          <button
            key={t}
            onClick={() => onChange(t)}
            className={`px-2 py-0.5 rounded text-[10px] capitalize cursor-pointer border-0 transition-all ${
              value === t
                ? isLight ? "bg-gray-900 text-white" : "bg-white text-gray-900"
                : "bg-transparent text-inherit"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

const SettingsGearIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
  </svg>
);

export default function SettingsPanel({ open, onClose, anchor = "left", triggerRef }) {
  const theme = useTheme();
  const ref = useRef(null);
  const isLight = theme.leftSidebarTheme === "light";
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
  }, [open]);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current?.contains(e.target)) return;
      if (triggerRef?.current?.contains(e.target)) return;
      onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose, triggerRef]);

  if (!mounted) return null;

  // "above" keeps the panel inside narrow screens, where there is no room beside the sidebar.
  const anchorStyle =
    anchor === "left"
      ? { left: "calc(100% + 10px)", bottom: 0 }
      : anchor === "above"
        ? { left: 8, bottom: "calc(100% + 8px)" }
      : anchor === "top-right"
        ? { right: 0, top: "calc(100% + 10px)" }
        : { right: "calc(100% + 10px)", bottom: 0 };

  return (
    <div
      ref={ref}
      onTransitionEnd={() => { if (!open) setMounted(false); }}
      className={`absolute z-50 rounded-lg border p-3 flex flex-col gap-3 scrollable transition-[opacity,transform] duration-150 ease-out ${
        visible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-1"
      } ${
        isLight
          ? "bg-white border-[#E5E4E7] shadow-[0_16px_40px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.03)]"
          : "bg-[#030712] border-[#263241] shadow-[0_16px_40px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)]"
      }`}
      style={{
        width: "220px",
        maxHeight: "calc(100vh - 24px)",
        overflowY: "auto",
        transformOrigin: anchor === "left" || anchor === "above" ? "bottom left" : anchor === "top-right" ? "top right" : "bottom right",
        ...anchorStyle,
      }}
    >
      <div className="flex items-center gap-1.5">
        <span className={isLight ? "text-gray-500" : "text-[#566273]"}><SettingsGearIcon /></span>
        <span className={`text-[11px] font-semibold tracking-widest ${isLight ? "text-gray-900" : "text-white"}`}>THEME</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <MiniThemeToggle label="Left sidebar" value={theme.leftSidebarTheme} onChange={theme.setLeftSidebarTheme} isLight={isLight} />
        <MiniThemeToggle label="Right sidebar" value={theme.rightSidebarTheme} onChange={theme.setRightSidebarTheme} isLight={isLight} />
        <MiniThemeToggle label="Main section" value={theme.mainSectionTheme} onChange={theme.setMainSectionTheme} isLight={isLight} />
      </div>

      <div className={`h-px ${isLight ? "bg-[#E5E4E7]" : "bg-[#1A2535]"}`} />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className={`text-[11px] ${isLight ? "text-gray-600" : "text-[#8B98A8]"}`}>Accent</span>
          <label className={`flex items-center gap-1 cursor-pointer text-[10px] ${isLight ? "text-gray-500" : "text-[#566273]"}`}>
            <input
              type="checkbox"
              checked={theme.accentMode === "gradient"}
              onChange={(e) => theme.setAccentMode(e.target.checked ? "gradient" : "color")}
              className="cursor-pointer"
              style={{ accentColor: "var(--accent-color)" }}
            />
            Gradient
          </label>
        </div>

        <div className="w-full h-5 rounded-md border border-white/8" style={{ background: "var(--accent-paint)" }} />

        <div className="flex items-center gap-1.5 flex-wrap">
          <MiniColorPicker color={theme.accentColor} onChange={theme.setAccentColor} label="color 1" isLight={isLight} />
          {theme.accentMode === "gradient" && (
            <MiniColorPicker color={theme.accentColorB} onChange={theme.setAccentColorB} label="color 2" isLight={isLight} />
          )}
          {ACCENT_COLORS.slice(0, 6).map((c) => (
            <button
              key={c.value}
              onClick={() => theme.setAccentColor(c.value)}
              title={c.label}
              aria-label={c.label}
              className="w-3 h-3 rounded-full cursor-pointer transition-all"
              style={{
                background: c.value,
                border: theme.accentColor === c.value ? "2px solid #FFFFFF" : "1px solid rgba(255,255,255,0.15)",
                transform: theme.accentColor === c.value ? "scale(1.15)" : "scale(1)",
              }}
            />
          ))}
        </div>

        {theme.accentMode === "gradient" && (
          <div>
            <div className="flex justify-between items-center mb-0.5">
              <span className={`text-[10px] ${isLight ? "text-gray-500" : "text-[#566273]"}`}>Angle</span>
              <span className={`text-[10px] ${isLight ? "text-gray-700" : "text-[#8B98A8]"}`}>{theme.gradientAngle}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              value={theme.gradientAngle}
              onChange={(e) => theme.setGradientAngle(Number(e.target.value))}
              className="w-full cursor-pointer h-3"
              style={{ accentColor: "var(--accent-color)" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
