import { useEffect, useRef, useState } from "react";

const svg = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" };
const ChevronDown = ({ className = "" }) => (<svg width="14" height="14" viewBox="0 0 24 24" strokeWidth="2.2" className={className} {...svg}><polyline points="6 9 12 15 18 9" /></svg>);
const CheckMark = () => (<svg width="13" height="13" viewBox="0 0 24 24" strokeWidth="2.6" {...svg}><polyline points="20 6 9 17 4 12" /></svg>);

// Custom dropdown in the sidebar's style. options: [{ value, label, hint?, group? }]. With allowCustom it is also a
// text input (type a value that is not in the list); with searchable it filters the list as you type.
export default function Dropdown({ id, value, options, onChange, placeholder, disabled, allowCustom, searchable, emptyText = "No options", isLight, base }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const muted = isLight ? "text-gray-500" : "text-white";

  const selected = options.find((o) => String(o.value) === String(value));
  const typing = Boolean(allowCustom || searchable);
  const q = filter.trim().toLowerCase();
  const visible = options.filter((o) => !typing || !q || [o.label, o.value, o.hint].some((t) => t && String(t).toLowerCase().includes(q)));

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => !rootRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const openList = () => {
    if (disabled) return;
    setFilter("");
    setActive(Math.max(0, options.findIndex((o) => String(o.value) === String(value))));
    setOpen(true);
  };
  const choose = (v) => {
    onChange(v);
    setOpen(false);
    setFilter("");
  };
  const onKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return openList();
      const dir = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (visible.length ? (i + dir + visible.length) % visible.length : 0));
    } else if (e.key === "Enter") {
      if (!open) {
        if (!typing) {
          e.preventDefault();
          openList();
        }
        return;
      }
      e.preventDefault();
      if (visible[active]) choose(visible[active].value);
      else if (allowCustom && filter.trim()) choose(filter.trim());
    } else if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const shown = open && typing ? filter : allowCustom ? String(value ?? "") : selected?.label ?? "";
  const rowClass = (on, hot) =>
    `flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 px-3 py-2 text-left text-[13.5px] transition-colors ${
      hot ? (isLight ? "bg-black/5" : "bg-white/8") : "bg-transparent"
    } ${on ? "text-(--accent-readable)" : isLight ? "text-gray-900" : "text-white"}`;

  return (
    <div ref={rootRef} className="relative">
      {typing ? (
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          value={shown}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          onFocus={openList}
          onClick={() => !open && openList()}
          onChange={(e) => {
            setFilter(e.target.value);
            setActive(0);
            setOpen(true);
            if (allowCustom) onChange(e.target.value);
          }}
          onKeyDown={onKeyDown}
          className={`${base} pr-10 ${open ? "border-(--accent-color)!" : ""}`}
        />
      ) : (
        <button
          id={id}
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={`${id}-list`}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openList())}
          onKeyDown={onKeyDown}
          className={`${base} flex cursor-pointer items-center pr-10 text-left disabled:cursor-not-allowed disabled:opacity-60 ${open ? "border-(--accent-color)!" : ""}`}
        >
          <span className={`truncate ${selected ? "" : isLight ? "text-gray-400" : "text-[#566273]"}`}>{selected?.label ?? placeholder}</span>
        </button>
      )}
      <span className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 transition-transform ${open ? "rotate-180" : ""} ${muted}`}><ChevronDown /></span>

      {open && (
        <ul
          id={`${id}-list`}
          ref={listRef}
          role="listbox"
          className={`scrollable absolute inset-x-0 top-full z-30 m-0 mt-1 max-h-60 list-none overflow-y-auto rounded-xl border p-1 shadow-2xl ${
            isLight ? "border-[#E5E4E7] bg-white text-gray-900" : "border-[#263241] bg-black text-white"
          }`}
        >
          {visible.length === 0 && (
            <li className={`px-4 py-3 text-[13px] ${muted}`}>{allowCustom && filter.trim() ? `Press Enter to use "${filter.trim()}"` : q ? "No matches" : emptyText}</li>
          )}
          {visible.map((o, i) => {
            const on = String(o.value) === String(value);
            const header = o.group && o.group !== visible[i - 1]?.group ? o.group : null;
            return (
              <li key={String(o.value)} role="presentation">
                {header && <div className={`px-4 pb-1 pt-2.5 text-[12px] font-medium ${muted}`}>{header}</div>}
                <button
                  type="button"
                  role="option"
                  aria-selected={on}
                  data-active={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(o.value)}
                  className={rowClass(on, i === active)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.label}</span>
                    {o.hint && <span className={`block truncate text-[11px] ${muted}`}>{o.hint}</span>}
                  </span>
                  {on && <CheckMark />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
