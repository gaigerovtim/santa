import type { ReactNode } from "react";

interface CarouselProps {
  children: ReactNode[];
  label: string;
}

/**
 * На телефоне — горизонтальная карусель со свайпом (CSS scroll-snap, без JS),
 * следующая карточка выглядывает справа, чтобы было видно, что можно листать.
 * С 768 px — сетка.
 */
export function Carousel({ children, label }: CarouselProps) {
  return (
    <ul
      className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-4 px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0"
      aria-label={label}
    >
      {children.map((child, i) => (
        <li key={i} className="w-[82%] shrink-0 snap-start sm:w-[60%] md:w-auto">
          {child}
        </li>
      ))}
    </ul>
  );
}
