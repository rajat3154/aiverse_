export const formatTime = (value) => {
  if (!value) return "";
  const date = new Date(typeof value === "number" && value < 1e12 ? value * 1000 : value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

/** True for tool output shaped like { documents: [{ content, metadata }] }. */
export const isDocumentOutput = (data) =>
  Boolean(data) && Array.isArray(data.documents) && data.documents.every((doc) => doc && typeof doc === "object" && "content" in doc);
