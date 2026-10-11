import { Fragment } from "react";
import { parseMarkdown, type Inline } from "@/lib/markdown";

// Renders the safe Markdown subset as React elements (no raw HTML).

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => {
        switch (n.t) {
          case "text":
            return <Fragment key={i}>{n.v}</Fragment>;
          case "b":
            return (
              <strong key={i} className="font-semibold">
                <Inlines nodes={n.c} />
              </strong>
            );
          case "i":
            return (
              <em key={i}>
                <Inlines nodes={n.c} />
              </em>
            );
          case "code":
            return (
              <code key={i} className="rounded-[5px] bg-gray-150 px-1 py-px font-mono text-[0.88em]">
                {n.v}
              </code>
            );
          case "a":
            return (
              <a
                key={i}
                href={n.href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-accent underline decoration-accent/30 underline-offset-2 hover:decoration-accent"
              >
                <Inlines nodes={n.c} />
              </a>
            );
        }
      })}
    </>
  );
}

export function Markdown({ source, compact = false }: { source: string; compact?: boolean }) {
  const blocks = parseMarkdown(source);
  const gap = compact ? "space-y-1.5" : "space-y-3";
  return (
    <div className={`${gap} ${compact ? "text-[14px]" : "text-[15px]"} leading-relaxed text-ink`}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h": {
            const size = compact
              ? "text-[15px]"
              : b.level === 1
                ? "text-[22px] tracking-[-0.01em]"
                : b.level === 2
                  ? "text-[18px]"
                  : "text-[16px]";
            return (
              <div key={i} role="heading" aria-level={b.level + 2} className={`font-semibold leading-snug ${size} ${i && !compact ? "pt-2" : ""}`}>
                <Inlines nodes={b.c} />
              </div>
            );
          }
          case "p":
            return (
              <p key={i}>
                <Inlines nodes={b.c} />
              </p>
            );
          case "ul":
          case "ol": {
            const Tag = b.type === "ul" ? "ul" : "ol";
            return (
              <Tag key={i} className={`${b.type === "ul" ? "list-disc" : "list-decimal"} space-y-0.5 pl-5 marker:text-gray-400`}>
                {b.items.map((it, j) => (
                  <li key={j}>
                    <Inlines nodes={it} />
                  </li>
                ))}
              </Tag>
            );
          }
          case "quote":
            return (
              <blockquote key={i} className="border-l-2 border-gray-250 pl-3 text-ink-2">
                <Inlines nodes={b.c} />
              </blockquote>
            );
          case "code":
            return (
              <pre key={i} className="overflow-x-auto rounded-[12px] bg-gray-100 p-3 font-mono text-[12.5px] leading-relaxed">
                {b.v}
              </pre>
            );
          case "hr":
            return <hr key={i} className="border-gray-200" />;
        }
      })}
    </div>
  );
}
