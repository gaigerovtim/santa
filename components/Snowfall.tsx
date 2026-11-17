import type { CSSProperties } from "react";

/**
 * Лёгкие падающие снежинки на CSS (без JavaScript). Позиции детерминированы,
 * чтобы серверный и клиентский HTML совпадали. При prefers-reduced-motion
 * анимация отключается глобально (globals.css), снежинки скрываются.
 */
const FLAKES = Array.from({ length: 28 }, (_, i) => {
  // Простой псевдослучайный генератор от индекса
  const r = (n: number) => {
    const x = Math.sin(i * 97.13 + n * 13.7) * 10000;
    return x - Math.floor(x);
  };
  return {
    left: `${(r(1) * 100).toFixed(2)}%`,
    size: 2 + Math.round(r(2) * 4),
    duration: `${(9 + r(3) * 10).toFixed(1)}s`,
    delay: `-${(r(4) * 18).toFixed(1)}s`,
    drift: `${Math.round((r(5) - 0.5) * 80)}px`,
    opacity: (0.35 + r(6) * 0.5).toFixed(2),
  };
});

export function Snowfall() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden"
      aria-hidden="true"
    >
      {FLAKES.map((f, i) => (
        <span
          key={i}
          className="animate-snow absolute -top-4 rounded-full bg-white will-change-transform"
          style={
            {
              left: f.left,
              width: f.size,
              height: f.size,
              opacity: f.opacity,
              animationDuration: f.duration,
              animationDelay: f.delay,
              "--snow-drift": f.drift,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
