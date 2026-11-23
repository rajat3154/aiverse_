import { useState } from "react";
import { formatTime } from "./format";
import { CONNECTION_SORTS } from "./sorting";
import { getStyles, STATUS_LABELS } from "./styles";
import { EmptyState, Skeleton, StatusDot, ToolkitLogo } from "./ui";

export default function MyConnectionsTab({ connections, toolkitBySlug, loading, busy, isLight, onManage, onDisconnect, onBrowse }) {
  const styles = getStyles(isLight);
  const [sortId, setSortId] = useState("status");
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
      <div className={`overflow-x-auto border ${isLight ? "border-black/8" : "border-white/10"}`}>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className={`${isLight ? "bg-black/2 text-gray-500" : "bg-white/5 text-[#AEBBCB]"}`}>
              {["Integration", "Account", "Status", "Updated", ""].map((heading) => (
                <th key={heading || "actions"} className={`whitespace-nowrap px-4 py-3 ${styles.label}`}>{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((connection) => {
              const slug = connection.toolkit?.slug;
              const toolkit = toolkitBySlug[slug] ?? { slug, name: slug };
              return (
                <tr key={connection.id} className={`border-t align-middle ${styles.divider}`}>
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <ToolkitLogo toolkit={toolkit} isLight={isLight} />
                      <span className="truncate text-sm font-semibold">{toolkit.name || "Account"}</span>
                    </div>
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 text-[13px] ${styles.body}`}>
                    {connection.alias || `Account ${connection.id.slice(-6)}`}
                    {connection.auth_scheme ? <span className={styles.muted}>{` · ${connection.auth_scheme.replace(/_/g, " ").toLowerCase()}`}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <StatusDot status={connection.status} label={STATUS_LABELS[connection.status] ?? connection.status} />
                    {connection.status_reason && connection.status !== "ACTIVE" && (
                      <p className="mt-0.5 max-w-64 text-xs text-rose-400">{connection.status_reason}</p>
                    )}
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 text-xs ${styles.muted}`}>{connection.updated_at ? formatTime(connection.updated_at) : "-"}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button type="button" className={styles.button} onClick={() => onManage(toolkit)}>Manage</button>
                      <button type="button" className={styles.danger} disabled={busy === connection.id} onClick={() => onDisconnect(connection, toolkit.name)}>
                        {busy === connection.id ? "…" : "Disconnect"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
