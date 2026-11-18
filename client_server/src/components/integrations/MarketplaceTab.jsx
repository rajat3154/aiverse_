import { useEffect, useMemo, useRef, useState } from "react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import FilterPanel from "./FilterPanel";
import { TOOLKIT_SORTS } from "./sorting";
import { getStyles } from "./styles";
import { EmptyState, Skeleton, ToolkitLogo } from "./ui";

const ROWS = 4;      // rows of apps per page, on every screen size
const GAP = 12;      // px between tiles

/** Page numbers to show: first, last, and the current page with one neighbour either side; gaps become '…'. */
function pageList(current, total) {
  const wanted = new Set([1, total, current - 1, current, current + 1].filter((n) => n >= 1 && n <= total));
  const pages = [...wanted].sort((a, b) => a - b);
  return pages.flatMap((n, i) => (i > 0 && n - pages[i - 1] > 1 ? ["…", n] : [n]));
}

function Pagination({ page, totalPages, onPage, styles, isLight }) {
  if (totalPages <= 1) return null;
  const number = (active) =>
    `min-w-9 cursor-pointer border px-2.5 py-1.5 text-[12.5px] transition-colors max-sm:min-h-10 ${
      active
        ? "border-(--accent-color) font-semibold text-(--accent-readable)"
        : `bg-transparent ${isLight ? "border-black/10 text-gray-700 hover:bg-black/4" : "border-white/10 text-[#C9D3E0] hover:bg-white/6"}`
    }`;
  return (
    <nav aria-label="Pagination" className="flex shrink-0 flex-wrap items-center justify-center gap-1.5 pt-3">
      <button type="button" className={styles.button} disabled={page === 1} onClick={() => onPage(page - 1)}>Previous</button>
      {pageList(page, totalPages).map((entry, index) =>
        entry === "…" ? (
          <span key={`gap-${index}`} className={`px-1 text-sm ${styles.muted}`} aria-hidden="true">…</span>
        ) : (
          <button key={entry} type="button" className={number(entry === page)} aria-current={entry === page ? "page" : undefined} aria-label={`Page ${entry}`} onClick={() => onPage(entry)}>
            {entry}
          </button>
        ),
      )}
      <button type="button" className={styles.button} disabled={page === totalPages} onClick={() => onPage(page + 1)}>Next</button>
    </nav>
  );
}

// Logo with its name underneath. Clicking opens the full details (description, accounts, every tool) in the side panel.
function IconTile({ toolkit, state, isLight, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(toolkit)}
      title={toolkit.name}
      aria-label={`${toolkit.name}${state === "connected" ? ", connected" : ""}`}
      className={`relative flex h-full min-h-0 w-full cursor-pointer flex-col items-center justify-center gap-1.5 overflow-hidden border bg-transparent px-1.5 py-1.5 text-inherit sm:gap-2 sm:px-2 sm:py-2 outline-none transition-colors focus-visible:border-(--accent-color) ${
        isLight ? "border-black/8 hover:border-black/25" : "border-white/10 hover:border-white/30"
      }`}
    >
      {/* smaller logo and a one-line name on phones, where the four rows leave each tile little height */}
      <span className="sm:hidden"><ToolkitLogo toolkit={toolkit} isLight={isLight} size="md" /></span>
      <span className="hidden sm:inline"><ToolkitLogo toolkit={toolkit} isLight={isLight} size="lg" /></span>
      <span className="line-clamp-1 w-full break-words text-center text-[11.5px] font-medium leading-tight sm:line-clamp-2 sm:text-[12.5px]">{toolkit.name}</span>
      {state === "connected" && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />}
    </button>
  );
}

export default function MarketplaceTab({ toolkits, loading, error, connectionState, isLight, onOpen }) {
  const styles = getStyles(isLight);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false); // the filters drawer on screens too narrow for the sidebar
  const [drawerShown, setDrawerShown] = useState(false); // drives the slide-in
  const searchRef = useRef(null);
  const gridRef = useRef(null);
  const [cols, setCols] = useState(4); // measured from the space available, so exactly four full rows fit
  const term = useDebouncedValue(search.trim().toLowerCase(), 250);

  // "/" jumps to search, like most developer tools. Escape closes the filters drawer.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setDrawerOpen(false);
      const target = e.target;
      const typing = target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Each app belongs to its catalog category ("Other" if it has none), so the list below covers every app.
  const tagged = useMemo(() => toolkits.map((toolkit) => ({ ...toolkit, tab: (toolkit.category || "Other").toLowerCase() })), [toolkits]);
  const categories = useMemo(() => {
    const counts = new Map();
    tagged.forEach((toolkit) => counts.set(toolkit.tab, (counts.get(toolkit.tab) ?? 0) + 1));
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [tagged]);
  const visible = useMemo(() => {
    const compare = TOOLKIT_SORTS[0].compare; // A to Z
    return tagged
      .filter(
        (toolkit) =>
          (category === "All" || toolkit.tab === category) &&
          (!term || `${toolkit.name} ${toolkit.slug} ${toolkit.description ?? ""}`.toLowerCase().includes(term)),
      )
      .sort(compare);
  }, [tagged, category, term]);
  const pageSize = cols * ROWS;
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, totalPages); // a smaller result set can never leave you on a page past the end
  const pageItems = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // How many tiles fit across: smaller tiles on phones, so three columns still fit.
  useEffect(() => {
    const element = gridRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      const minimum = width < 560 ? 92 : 120;
      setCols(Math.max(2, Math.floor((width + GAP) / (minimum + GAP))));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Slide the drawer in on the next frame, like the toolkit panel.
  useEffect(() => {
    if (!drawerOpen) return undefined;
    const frame = requestAnimationFrame(() => setDrawerShown(true));
    return () => {
      cancelAnimationFrame(frame);
      setDrawerShown(false);
    };
  }, [drawerOpen]);

  const activeCount = category !== "All" ? 1 : 0;
  const reset = () => {
    setCategory("All");
    setPage(1);
  };
  const panel = (
    <FilterPanel
      isLight={isLight}
      categories={categories}
      category={category}
      onCategory={(value) => {
        setCategory(value);
        setPage(1);
      }}
      total={tagged.length}
      onReset={reset}
    />
  );

  const filtersButton = (
    <button
      type="button"
      onClick={() => setDrawerOpen(true)}
      aria-haspopup="dialog"
      className={`${styles.button} flex shrink-0 items-center gap-2 lg:hidden`}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 6h18M7 12h10M10 18h4" /></svg>
      Categories{activeCount > 0 ? " · 1" : ""}
    </button>
  );

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:pr-6">
        {error && <div role="alert" className={`mb-3 shrink-0 ${styles.error}`}>{error}</div>}

        <div className="mb-3 flex shrink-0 items-center gap-2 sm:gap-3">
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="Search integrations"
            placeholder="Search apps…"
            className={`${styles.input} min-w-0 flex-1`}
          />
          <p className={`m-0 hidden shrink-0 text-[12px] sm:block ${styles.muted}`}>
            {loading ? "" : `${visible.length} app${visible.length === 1 ? "" : "s"}`}
          </p>
          {filtersButton}
        </div>

        {/* Exactly four rows. The grid takes whatever height is left and splits it into four equal rows. */}
        <div ref={gridRef} className="min-h-[19rem] flex-1">
          {loading ? (
            <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${ROWS}, minmax(0, 11rem))`, alignContent: "start", gap: GAP }}>
              {Array.from({ length: pageSize }, (_, n) => <Skeleton key={n} isLight={isLight} className="h-full w-full" />)}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState isLight={isLight} title={toolkits.length === 0 ? "No integrations are available." : "No integrations match your search."}>
              {toolkits.length === 0 ? (
                "No apps could be loaded. Check that the tools provider is configured on the server, then reload."
              ) : (
                <button type="button" className={`${styles.link} mt-2`} onClick={() => { setSearch(""); reset(); }}>Clear search and category</button>
              )}
            </EmptyState>
          ) : (
            <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${ROWS}, minmax(0, 11rem))`, alignContent: "start", gap: GAP }}>
              {pageItems.map((toolkit) => (
                <IconTile key={toolkit.slug} toolkit={toolkit} state={connectionState(toolkit)} isLight={isLight} onOpen={onOpen} />
              ))}
            </div>
          )}
        </div>

        <Pagination page={currentPage} totalPages={totalPages} onPage={setPage} styles={styles} isLight={isLight} />
      </div>

      {/* Large screens: the filters sidebar on the right. It scrolls by itself when its options do not fit. */}
      <aside
        aria-label="Categories"
        className={`scrollable hidden w-[248px] shrink-0 overflow-y-auto border-l py-2 lg:block ${styles.line}`}
      >
        {panel}
      </aside>

      {/* Narrower screens: the same filters slide in from the right */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[65] lg:hidden" role="presentation">
          <div className={`absolute inset-0 bg-black/45 transition-opacity duration-200 ${drawerShown ? "opacity-100" : "opacity-0"}`} onClick={() => setDrawerOpen(false)} />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Categories"
            className={`absolute inset-y-0 right-0 flex w-full max-w-xs flex-col border-l shadow-2xl transition-transform duration-200 ease-out ${
              drawerShown ? "translate-x-0" : "translate-x-full"
            } ${isLight ? "border-[#E5E4E7] bg-white text-gray-900" : "border-[#263241]/60 bg-black text-white"}`}
          >
            <div className="scrollable min-h-0 flex-1 overflow-y-auto overscroll-contain py-4">{panel}</div>
            <div className={`flex shrink-0 gap-2 border-t px-4 py-3 ${styles.line}`}>
              <button type="button" className={`${styles.primary} flex-1`} onClick={() => setDrawerOpen(false)}>
                Show {visible.length} app{visible.length === 1 ? "" : "s"}
              </button>
              <button type="button" className={styles.button} onClick={() => setDrawerOpen(false)} aria-label="Close categories">✕</button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
