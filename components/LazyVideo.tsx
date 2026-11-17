"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

interface LazyVideoProps {
  src: string;
  poster: string;
  /** Текстовое описание ролика для экранных дикторов. */
  label: string;
  /** Постер — главный элемент первого экрана (LCP): загрузить сразу и с высоким приоритетом. */
  eager?: boolean;
  sizes?: string;
}

/**
 * Пример видео: постер через next/image, сам ролик загружается и играет
 * только когда виден на экране (muted, loop, playsinline — для автоплея на телефонах).
 * При prefers-reduced-motion ролик не запускается сам — показывается постер.
 */
export function LazyVideo({ src, poster, label, eager = false, sizes }: LazyVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          video.play().catch(() => {
            /* автоплей запрещён — остаётся постер */
          });
        } else {
          video.pause();
        }
      },
      { rootMargin: "200px 0px", threshold: 0.25 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="absolute inset-0" role="img" aria-label={label}>
      <Image
        src={poster}
        alt=""
        fill
        // Постер уже маленький webp (~10 КБ): отдаём как есть, без задержки на оптимизацию.
        unoptimized
        loading={eager ? "eager" : "lazy"}
        fetchPriority={eager ? "high" : "auto"}
        sizes={sizes ?? "(min-width: 1024px) 50vw, 100vw"}
        className="object-cover"
      />
      <video
        ref={ref}
        className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
          playing ? "opacity-100" : "opacity-0"
        }`}
        src={active ? src : undefined}
        muted
        loop
        playsInline
        preload="none"
        aria-hidden="true"
        onPlaying={() => setPlaying(true)}
      />
    </div>
  );
}
