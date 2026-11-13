// A small, dependency-free Markdown renderer for chat replies. It builds React elements (never raw HTML), so model output can't inject markup.
// Supports headings, paragraphs, bold, italic, inline code, fenced code, links (http/https), lists, tables, blockquotes and rules.

const INLINE = /(`[^`]+`)|(\*\*[^*]+\*\*)|(__[^_]+__)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\(https?:\/\/[^\s)]+\))/;

function inline(text, isLight, keyBase = "i") {
  const out = [];
  let rest = text;
  let n = 0;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m) {
      out.push(rest);
      break;
    }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const token = m[0];
    const key = `${keyBase}${n++}`;
    if (m[1]) {
      out.push(
        <code key={key} className={`px-1 py-0.5 font-mono text-[0.92em] ${isLight ? "bg-black/6" : "bg-white/10"}`}>
          {token.slice(1, -1)}
        </code>
      );
    } else if (m[2] || m[3]) {
      out.push(<strong key={key} className="font-semibold">{inline(token.slice(2, -2), isLight, `${key}.`)}</strong>);
    } else if (m[4]) {
      out.push(<em key={key}>{inline(token.slice(1, -1), isLight, `${key}.`)}</em>);
    } else {
      const link = /^\[([^\]]+)\]\((.+)\)$/.exec(token);
      out.push(
        <a key={key} href={link[2]} target="_blank" rel="noopener noreferrer" className="text-(--accent-readable) underline">
          {link[1]}
        </a>
      );
    }
    rest = rest.slice(m.index + token.length);
  }
  return out;
}

const isTableSeparator = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line || "");
const splitRow = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const BLOCK_START = /^(\s*```|\s{0,3}#{1,6}\s|\s*[-*+]\s+|\s*\d+[.)]\s+|\s*>|\s*([-*_])\s*\2\s*\2[\s\2]*$)/;

function parseBlocks(source, isLight) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  let k = 0;
  const line = isLight ? "border-[#E5E4E7]" : "border-[#263241]";

  while (i < lines.length) {
    const cur = lines[i];
    const key = `b${k++}`;

    if (!cur.trim()) {
      i++;
      continue;
    }

    // fenced code
    const fence = /^\s*```(\S*)/.exec(cur);
    if (fence) {
      const body = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      i++; // closing fence (or end of a reply still streaming)
      blocks.push(
        <div key={key} className={`my-2 overflow-hidden border ${line} ${isLight ? "bg-[#F6F6F8]" : "bg-[#0B0F14]"}`}>
          {fence[1] && <div className={`border-b px-3 py-1 text-[11px] uppercase tracking-wider ${line} ${isLight ? "text-gray-500" : "text-[#8B98A8]"}`}>{fence[1]}</div>}
          <pre className="m-0 overflow-x-auto px-3 py-2.5 text-[12.5px] leading-relaxed"><code className="font-mono">{body.join("\n")}</code></pre>
        </div>
      );
      continue;
    }

    // heading
    const h = /^\s{0,3}(#{1,6})\s+(.*)$/.exec(cur);
    if (h) {
      const size = ["text-[18px]", "text-[16.5px]", "text-[15.5px]", "text-[14.5px]", "text-[14px]", "text-[13.5px]"][h[1].length - 1];
      blocks.push(<p key={key} className={`m-0 mb-1.5 mt-3 font-semibold first:mt-0 ${size}`}>{inline(h[2], isLight, `${key}.`)}</p>);
      i++;
      continue;
    }

    // rule
    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(cur)) {
      blocks.push(<hr key={key} className={`my-3 border-0 border-t ${line}`} />);
      i++;
      continue;
    }

    // table
    if (cur.includes("|") && isTableSeparator(lines[i + 1])) {
      const head = splitRow(cur);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(splitRow(lines[i++]));
      blocks.push(
        <div key={key} className="my-2 overflow-x-auto">
          <table className={`w-full border-collapse text-[12.5px] ${line}`}>
            <thead>
              <tr>{head.map((c, x) => <th key={x} className={`border px-2.5 py-1.5 text-left font-semibold ${line} ${isLight ? "bg-black/4" : "bg-white/6"}`}>{inline(c, isLight, `${key}h${x}.`)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, y) => (
                <tr key={y}>{r.map((c, x) => <td key={x} className={`border px-2.5 py-1.5 align-top ${line}`}>{inline(c, isLight, `${key}r${y}c${x}.`)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // list
    const ul = /^\s*[-*+]\s+/.test(cur);
    if (ul || /^\s*\d+[.)]\s+/.test(cur)) {
      const marker = ul ? /^\s*[-*+]\s+/ : /^\s*\d+[.)]\s+/;
      const items = [];
      while (i < lines.length && marker.test(lines[i])) items.push(lines[i++].replace(marker, ""));
      const Tag = ul ? "ul" : "ol";
      blocks.push(
        <Tag key={key} className={`my-2 m-0 flex flex-col gap-1 pl-5 ${ul ? "list-disc" : "list-decimal"}`}>
          {items.map((t, x) => <li key={x} className="pl-0.5">{inline(t, isLight, `${key}.${x}.`)}</li>)}
        </Tag>
      );
      continue;
    }

    // blockquote
    if (/^\s*>/.test(cur)) {
      const quoted = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) quoted.push(lines[i++].replace(/^\s*>\s?/, ""));
      blocks.push(
        <blockquote key={key} className={`my-2 border-l-2 pl-3 ${isLight ? "border-gray-300 text-gray-600" : "border-[#2E3A4A] text-[#AEBBCB]"}`}>
          {inline(quoted.join(" "), isLight, `${key}.`)}
        </blockquote>
      );
      continue;
    }

    // paragraph: runs until a blank line or the start of another block
    const para = [cur];
    i++;
    while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i]) && !(lines[i].includes("|") && isTableSeparator(lines[i + 1]))) para.push(lines[i++]);
    blocks.push(<p key={key} className="m-0 my-1.5 first:mt-0 last:mb-0">{inline(para.join("\n"), isLight, `${key}.`)}</p>);
  }
  return blocks;
}

export default function Markdown({ children, isLight = false }) {
  return <div className="break-words whitespace-pre-wrap [&>*]:whitespace-normal [&_pre]:whitespace-pre [&_pre_code]:whitespace-pre">{parseBlocks(String(children ?? ""), isLight)}</div>;
}
