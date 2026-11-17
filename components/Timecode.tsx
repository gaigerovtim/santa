"use client";

import { useEffect, useState } from "react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Формат как у регистраторов: 31-12-2026 03:14:07 */
export function formatTimecode(totalSeconds: number, date = "31-12-2026") {
  const s = ((totalSeconds % 86400) + 86400) % 86400;
  return `${date} ${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/**
 * Идущий таймкод «камеры». Первый рендер — фиксированное время (без расхождения
 * серверного и клиентского HTML), затем тикает раз в секунду.
 */
export function Timecode({ start = 3 * 3600 + 14 * 60 + 7 }: { start?: number }) {
  const [seconds, setSeconds] = useState(start);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <time className="tabular-nums" aria-hidden="true">
      {formatTimecode(seconds)}
    </time>
  );
}
