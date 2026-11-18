import { getStyles } from "./styles";

const titleCase = (name) => name.replace(/\b\w/g, (letter) => letter.toUpperCase());

/**
 * Every category that any app has, with its app count. Categories come straight from the catalog, so the list always
 * covers all apps; apps without one are grouped under "Other". The active entry gets the accent bar the navigation uses.
 */
export default function FilterPanel({ isLight, categories, category, onCategory, total, onReset }) {
  const styles = getStyles(isLight);
  const entries = [["All", total], ...categories];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-3">
        <p className={`m-0 ${styles.label} ${styles.muted}`}>Categories · {categories.length}</p>
        {category !== "All" && <button type="button" className={styles.link} onClick={onReset}>Reset</button>}
      </div>
      <div role="radiogroup" aria-label="Category" className="flex flex-col">
        {entries.map(([name, count]) => {
          const active = category === name;
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onCategory(name)}
              className={`flex w-full cursor-pointer items-center justify-between gap-3 border-0 border-l-2 bg-transparent px-3 py-2 text-left text-[13px] transition-colors max-sm:py-2.5 ${
                active
                  ? "border-(--accent-color) font-semibold text-(--accent-readable)"
                  : `border-transparent ${styles.body} ${isLight ? "hover:bg-black/4" : "hover:bg-white/5"}`
              }`}
            >
              <span className="truncate">{name === "All" ? "All apps" : titleCase(name)}</span>
              <span className={`shrink-0 text-[11.5px] font-normal ${styles.muted}`}>{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
