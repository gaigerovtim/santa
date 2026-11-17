import type { ReactNode } from "react";

export interface AccordionItem {
  question: string;
  answer: ReactNode;
}

/**
 * Аккордеон на нативных <details>/<summary>: работает без JavaScript,
 * с клавиатуры и с экранными дикторами.
 */
export function Accordion({ items }: { items: readonly AccordionItem[] }) {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      {items.map((item) => (
        <details key={item.question} className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-base font-semibold transition-colors hover:text-garland sm:px-6 [&::-webkit-details-marker]:hidden">
            {item.question}
            <svg
              className="h-5 w-5 shrink-0 text-garland transition-transform duration-200 group-open:rotate-45"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M10 4v12M4 10h12" strokeLinecap="round" />
            </svg>
          </summary>
          <div className="px-5 pb-5 leading-relaxed text-muted sm:px-6">{item.answer}</div>
        </details>
      ))}
    </div>
  );
}
