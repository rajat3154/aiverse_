// Sort options and comparators shared by the integrations screens.
const byName = (a, b) => (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" });
const time = (value) => (value ? new Date(value).getTime() || 0 : 0);

export const TOOLKIT_SORTS = [
  { id: "name-asc", label: "Name A–Z", compare: byName },
  { id: "name-desc", label: "Name Z–A", compare: (a, b) => byName(b, a) },
  { id: "tools", label: "Most tools", compare: (a, b) => (b.tools_count ?? 0) - (a.tools_count ?? 0) || byName(a, b) },
  { id: "connected", label: "Connected first", compare: (a, b) => Number(b.connected) - Number(a.connected) || byName(a, b) },
];

export const TOOL_SORTS = [
  { id: "name-asc", label: "Name A–Z", compare: byName },
  { id: "name-desc", label: "Name Z–A", compare: (a, b) => byName(b, a) },
  { id: "inputs-desc", label: "Most inputs", compare: (a, b) => (b.parameter_count ?? 0) - (a.parameter_count ?? 0) || byName(a, b) },
  { id: "simple", label: "Fewest required inputs", compare: (a, b) => (a.required_parameters?.length ?? 0) - (b.required_parameters?.length ?? 0) || byName(a, b) },
];

const STATUS_RANK = { ACTIVE: 0, INITIATED: 1, INITIALIZING: 1, FAILED: 2, EXPIRED: 2, INACTIVE: 3, REVOKED: 3 };

export const CONNECTION_SORTS = [
  { id: "recent", label: "Recently updated", compare: (a, b) => time(b.updated_at) - time(a.updated_at) },
  { id: "name", label: "Integration name", compare: (a, b) => (a.toolkitName ?? "").localeCompare(b.toolkitName ?? "", undefined, { sensitivity: "base" }) },
  { id: "status", label: "Status", compare: (a, b) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || time(b.updated_at) - time(a.updated_at) },
];
