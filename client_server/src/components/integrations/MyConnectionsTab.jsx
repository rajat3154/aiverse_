import { useState } from "react";
import { formatTime } from "./format";
import { CONNECTION_SORTS } from "./sorting";
import { getStyles, STATUS_LABELS } from "./styles";
import { EmptyState, Skeleton, StatusDot, ToolkitLogo } from "./ui";

export default function MyConnectionsTab({ connections, toolkitBySlug, loading, busy, isLight, onManage, onDisconnect, onBrowse }) {
  const styles = getStyles(isLight);
  const [sortId, setSortId] = useState("recent");
  const sorted = connections
    .map((connection) => ({ ...connection, toolkitName: toolkitBySlug[connection.toolkit?.slug]?.name ?? connection.toolkit?.slug }))
    .sort(CONNECTION_SORTS.find((option) => option.id === sortId).compare);

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2].map((n) => (
          <Skeleton key={n} isLight={isLight} className="h-16 w-full" />
        ))}
      </div>
    );
  }
  if (connections.length === 0) {
    return (
      <EmptyState isLight={isLight} title="No connected accounts yet">
        <button type="button" className={`${styles.primary} mt-3`} onClick={onBrowse}>
          Browse integrations
        </button>
      </EmptyState>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className={`${styles.label} ${styles.muted}`}>{connections.length} connected account{connections.length === 1 ? "" : "s"}</p>
        <select value={sortId} onChange={(e) => setSortId(e.target.value)} className={`${styles.input} py-1.5 sm:text-xs`} aria-label="Sort connections">
          {CONNECTION_SORTS.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        {sorted.map((connection) => {
          const slug = connection.toolkit?.slug;
          const toolkit = toolkitBySlug[slug] ?? { slug, name: slug };
          return (
            <article key={connection.id} className={styles.row}>
              <ToolkitLogo toolkit={toolkit} isLight={isLight} />
              <div className="min-w-0 flex-1 basis-40">
                <h3 className="truncate text-sm font-semibold">{toolkit.name || "Account"}</h3>
                <p className={`truncate text-xs ${styles.muted}`}>
                  {connection.alias || `Account ${connection.id.slice(-6)}`}
                  {connection.auth_scheme ? ` · ${connection.auth_scheme.replace(/_/g, " ").toLowerCase()}` : ""}
                </p>
                {connection.status_reason && connection.status !== "ACTIVE" && (
                  <p className="mt-0.5 truncate text-xs text-rose-400">{connection.status_reason}</p>
                )}
              </div>
              <div className="hidden w-44 shrink-0 text-xs md:block">
                <StatusDot status={connection.status} label={STATUS_LABELS[connection.status] ?? connection.status} />
                <p className={`mt-0.5 ${styles.muted}`}>{connection.updated_at ? `Updated ${formatTime(connection.updated_at)}` : ""}</p>
              </div>
              <div className="flex w-full shrink-0 justify-end gap-2 sm:w-auto">
                <button type="button" className={styles.button} onClick={() => onManage(toolkit)}>Manage</button>
                <button type="button" className={styles.danger} disabled={busy === connection.id} onClick={() => onDisconnect(connection, toolkit.name)}>
                  {busy === connection.id ? "…" : "Disconnect"}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
