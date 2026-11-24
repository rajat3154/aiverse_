import { useState } from "react";

// Renders tool output shaped like { documents: [{ content, metadata }], count } as a clean results list:
// video rows (YouTube search, playlists, video details) and text rows (transcript chunks, comments).

const HIDDEN_KEYS = new Set(["source", "url", "thumbnail_url", "video_id", "channel_id", "playlist_id", "title", "channel_title", "published_at", "position"]);
const STAT_KEYS = [
  [/view/, "views"],
  [/like/, "likes"],
  [/comment|repl/, "comments"],
];

const compact = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });

// "Title: X\n\nDescription: Y" -> { title, body }. Anything else (a transcript chunk, a comment) is just body text.
const parseContent = (content, metadata) => {
  const text = typeof content === "string" ? content : JSON.stringify(content, null, 2);
  const match = text.match(/^Title:\s*(.*?)(?:\n\s*\n(?:Description:\s*)?([\s\S]*))?$/);
  if (match) return { title: match[1].trim(), body: (match[2] ?? "").trim() };
  return { title: metadata?.title ?? null, body: text.trim() };
};

const label = (key) => key.replace(/_/g, " ").replace(/(^|\s)\w/g, (c) => c.toUpperCase());

// ISO 8601 ("PT1H2M3S") or plain seconds -> "1:02:03".
const duration = (value) => {
  let seconds = typeof value === "number" ? value : null;
  if (seconds === null && typeof value === "string") {
    const m = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
    if (!m) return null;
    seconds = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  }
  const h = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  const ss = String(Math.floor(seconds % 60)).padStart(2, "0");
  return h ? `${h}:${String(mm).padStart(2, "0")}:${ss}` : `${mm}:${ss}`;
};

const formatValue = (key, value) => {
  if (value === null || value === undefined || value === "") return null;
  if (/duration/.test(key)) return duration(value) ?? String(value);
  if (/(_at|date)$/.test(key) && !Number.isNaN(Date.parse(value))) return new Date(value).toLocaleString();
  if (typeof value === "number") return /(count|view|like|reply|replies|subscriber)/.test(key) ? compact.format(value) : value.toLocaleString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const when = (value) =>
  Number.isNaN(Date.parse(value)) ? value : new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

// Pulls views / likes / comments / duration out of the metadata; whatever is left becomes plain "Label: value" facts.
const summarize = (metadata) => {
  const entries = Object.entries(metadata).filter(([key]) => !HIDDEN_KEYS.has(key));
  const used = new Set();
  const length = entries.find(([key]) => /duration/.test(key));
  if (length) used.add(length[0]);
  const stats = [];
  for (const [pattern, name] of STAT_KEYS) {
    const hit = entries.find(([key, value]) => !used.has(key) && pattern.test(key) && typeof value === "number");
    if (hit) {
      used.add(hit[0]);
      stats.push(`${compact.format(hit[1])} ${name}`);
    }
  }
  const facts = entries
    .filter(([key]) => !used.has(key))
    .map(([key, value]) => [label(key), formatValue(key, value)])
    .filter(([, value]) => value !== null);
  return { stats, facts, length: length ? formatValue(length[0], length[1]) : null };
};

function Expandable({ text, limit, styles }) {
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const long = text.length > limit;
  return (
    <>
      <p className={`m-0 mt-2 text-[13px] leading-relaxed whitespace-pre-wrap wrap-break-word ${styles.body}`}>
        {open || !long ? text : `${text.slice(0, limit).trimEnd()}…`}
      </p>
      {long && (
        <button type="button" className={`${styles.link} mt-1`} onClick={() => setOpen((v) => !v)}>
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </>
  );
}

function CopyButton({ text, styles, children }) {
  const [done, setDone] = useState(false);
  const copy = () =>
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      })
      .catch(() => {});
  return (
    <button type="button" className={styles.link} onClick={copy}>
      {done ? "Copied" : children}
    </button>
  );
}

function VideoRow({ doc, styles }) {
  const [open, setOpen] = useState(false);
  const metadata = doc.metadata ?? {};
  const { title, body } = parseContent(doc.content, metadata);
  const { stats, facts, length } = summarize(metadata);
  const byline = [metadata.channel_title, metadata.published_at && when(metadata.published_at)].filter(Boolean);
  const long = body.length > 140;

  return (
    <li className={`flex gap-4 py-4 max-sm:flex-col ${styles.divider} border-b last:border-b-0`}>
      <a
        href={metadata.url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block aspect-video w-full shrink-0 self-start overflow-hidden bg-black/20 sm:w-60"
        aria-label={`Open ${title || "video"} on YouTube`}
      >
        <img src={metadata.thumbnail_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        {length && <span className="absolute bottom-1.5 right-1.5 bg-black/85 px-1.5 py-0.5 text-[11px] font-medium text-white">{length}</span>}
      </a>
      {/* Same height as the 16:9 thumbnail (240px wide -> 135px); "Show more" lets it grow. */}
      <div className={`flex min-w-0 flex-1 flex-col overflow-hidden ${open ? "" : "sm:h-33.75"}`}>
        <a href={metadata.url} target="_blank" rel="noopener noreferrer" className={`block text-[15px] font-semibold leading-snug text-inherit hover:text-(--accent-readable) ${open ? "" : "line-clamp-2"}`}>
          {metadata.position !== undefined && <span className={`mr-2 font-normal ${styles.muted}`}>{Number(metadata.position) + 1}.</span>}
          {title || metadata.url}
        </a>
        {(byline.length > 0 || stats.length > 0) && (
          <p className={`m-0 mt-1 text-xs wrap-break-word sm:truncate ${styles.muted}`}>{[...byline, ...stats].join(" · ")}</p>
        )}
        {body && (
          <p className={`m-0 mt-1 text-[13px] leading-snug whitespace-pre-wrap wrap-break-word ${styles.body} ${open ? "" : "line-clamp-2"}`}>{body}</p>
        )}
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-0.5 pt-1.5 text-xs">
          {open && facts.map(([name, value]) => (
            <span key={name} className={styles.muted}>
              {name}: <span className={styles.body}>{value}</span>
            </span>
          ))}
          <span className="flex gap-3">
            <a href={metadata.url} target="_blank" rel="noopener noreferrer" className={styles.link}>Watch</a>
            <CopyButton text={metadata.url} styles={styles}>Copy link</CopyButton>
            {(long || facts.length > 0) && (
              <button type="button" className={styles.link} onClick={() => setOpen((v) => !v)}>
                {open ? "Show less" : "Show more"}
              </button>
            )}
          </span>
        </div>
      </div>
    </li>
  );
}

function TextRow({ doc, index, total, styles }) {
  const metadata = doc.metadata ?? {};
  const { title, body } = parseContent(doc.content, metadata);
  const { stats, facts } = summarize(metadata);
  const meta = [...stats, ...facts.map(([name, value]) => `${name}: ${value}`)];
  return (
    <li className={`flex gap-2 py-3.5 sm:gap-4 ${styles.divider} border-b last:border-b-0`}>
      <span className={`w-5 shrink-0 sm:w-7 pt-0.5 text-right text-xs font-semibold tabular-nums ${styles.muted}`}>{index + 1}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3 max-[360px]:flex-col max-[360px]:gap-1">
          <p className="m-0 text-sm font-semibold leading-snug">{title || `Part ${index + 1} of ${total}`}</p>
          <CopyButton text={body} styles={styles}>Copy</CopyButton>
        </div>
        {meta.length > 0 && <p className={`m-0 mt-0.5 text-xs ${styles.muted}`}>{meta.join(" · ")}</p>}
        <Expandable text={body} limit={420} styles={styles} />
      </div>
    </li>
  );
}

export default function DocumentResults({ data, styles, isLight }) {
  const documents = data.documents;
  if (!documents.length) return <p className={`m-0 text-xs ${styles.muted}`}>No results.</p>;
  const count = data.count ?? documents.length;
  return (
    <div className={`border ${styles.divider} ${isLight ? "bg-white" : "bg-black"}`}>
      <p className={`m-0 border-b px-4 py-2 text-[11px] font-semibold uppercase tracking-wider ${styles.divider} ${styles.muted}`}>
        {count} result{count === 1 ? "" : "s"}
      </p>
      <ul className="m-0 max-h-[36rem] list-none overflow-auto px-3 py-0 sm:px-4">
        {documents.map((doc, index) => {
          const key = doc.metadata?.video_id ?? doc.metadata?.comment_id ?? index;
          return doc.metadata?.url && doc.metadata?.thumbnail_url ? (
            <VideoRow key={key} doc={doc} styles={styles} />
          ) : (
            <TextRow key={key} doc={doc} index={index} total={documents.length} styles={styles} />
          );
        })}
      </ul>
    </div>
  );
}
