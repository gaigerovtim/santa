/**
 * Минимальный рендер markdown для документов (content/*.md): заголовки #/##/###,
 * абзацы, маркированные и нумерованные списки, **жирный**. Без HTML — безопасно.
 */
import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

export function renderMarkdown(source: string): ReactNode[] {
  const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/);
  return blocks.map((block, i) => {
    const lines = block.split("\n").filter(Boolean);
    if (!lines.length) return null;
    const first = lines[0];
    const heading = /^(#{1,3})\s+(.*)$/.exec(first);
    if (heading && lines.length === 1) {
      const level = heading[1].length;
      const cls = ["text-3xl font-bold sm:text-4xl", "mt-10 text-2xl font-bold", "mt-6 text-xl font-semibold"][level - 1];
      const Tag = (["h1", "h2", "h3"] as const)[level - 1];
      return (
        <Tag key={i} className={cls}>
          {inline(heading[2])}
        </Tag>
      );
    }
    if (lines.every((l) => /^[-*]\s+/.test(l))) {
      return (
        <ul key={i} className="mt-4 list-disc space-y-1 pl-6">
          {lines.map((l, j) => (
            <li key={j}>{inline(l.replace(/^[-*]\s+/, ""))}</li>
          ))}
        </ul>
      );
    }
    if (lines.every((l) => /^\d+\.\s+/.test(l))) {
      return (
        <ol key={i} className="mt-4 list-decimal space-y-1 pl-6">
          {lines.map((l, j) => (
            <li key={j}>{inline(l.replace(/^\d+\.\s+/, ""))}</li>
          ))}
        </ol>
      );
    }
    return (
      <p key={i} className="mt-4 leading-relaxed">
        {inline(lines.join(" "))}
      </p>
    );
  });
}
