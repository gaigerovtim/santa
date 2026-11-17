import type { ReactNode } from "react";

interface SectionProps {
  id?: string;
  title: string;
  eyebrow?: string;
  intro?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Блок главной: заголовок, «камерная» надпись над ним и содержимое. */
export function Section({ id, title, eyebrow, intro, children, className = "" }: SectionProps) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} className={`scroll-mt-20 py-14 sm:py-20 ${className}`}>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <header className="mb-8 max-w-2xl sm:mb-12">
          {eyebrow && (
            <p className="mb-3 font-mono text-xs font-semibold tracking-[0.2em] text-garland uppercase">
              {eyebrow}
            </p>
          )}
          <h2 id={headingId} className="text-3xl font-bold sm:text-4xl">
            {title}
          </h2>
          {intro && <p className="mt-4 text-lg leading-relaxed text-muted">{intro}</p>}
        </header>
        {children}
      </div>
    </section>
  );
}
