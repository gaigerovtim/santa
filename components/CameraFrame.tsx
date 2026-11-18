import type { ReactNode } from "react";
import { Timecode } from "./Timecode";

interface CameraFrameProps {
  children: ReactNode;
  /** Подпись камеры в нижнем углу. */
  label?: string;
  /** Начальное время таймкода, секунды от полуночи. */
  start?: number;
  className?: string;
  /** Соотношение сторон экрана, по умолчанию 16:9. */
  aspect?: string;
  /** Показывать REC, таймкод и подпись. Для готового видео — нет: они уже вшиты в ролик. */
  overlay?: boolean;
}

/**
 * Фирменная рамка «экрана камеры наблюдения»: тонкая рамка, таймкод в углу,
 * мигающая точка ● REC и подпись камеры.
 */
export function CameraFrame({
  children,
  label = "КАМЕРА 2 · ГОСТИНАЯ",
  start,
  className = "",
  aspect = "aspect-video",
  overlay = true,
}: CameraFrameProps) {
  return (
    <figure
      className={`relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-black p-1.5 shadow-[0_20px_60px_-20px_rgb(0_0_0/0.8)] ${className}`}
    >
      <div className={`relative overflow-hidden rounded-[calc(var(--radius-card)-6px)] ${aspect}`}>
        {children}

        {/* Оверлей камеры: не перехватывает клики, скрыт от экранных дикторов */}
        {overlay && (
          <div
            className="pointer-events-none absolute inset-0 font-mono text-[10px] font-semibold uppercase tracking-wider text-white/85 sm:text-xs"
            aria-hidden="true"
          >
            <span className="absolute top-2.5 left-3 flex items-center gap-1.5 sm:top-3 sm:left-4">
              <span className="animate-rec text-santa">●</span> REC
            </span>
            <span className="absolute top-2.5 right-3 sm:top-3 sm:right-4">
              <Timecode start={start} />
            </span>
            <span className="absolute bottom-2.5 left-3 sm:bottom-3 sm:left-4">{label}</span>
            {/* уголки видоискателя */}
            <span className="absolute top-8 left-3 h-3 w-3 border-t border-l border-white/40 sm:top-10 sm:left-4" />
            <span className="absolute top-8 right-3 h-3 w-3 border-t border-r border-white/40 sm:top-10 sm:right-4" />
            <span className="absolute right-3 bottom-8 h-3 w-3 border-r border-b border-white/40 sm:right-4 sm:bottom-10" />
            <span className="absolute bottom-8 left-3 h-3 w-3 border-b border-l border-white/40 sm:bottom-10 sm:left-4" />
          </div>
        )}
      </div>
    </figure>
  );
}
