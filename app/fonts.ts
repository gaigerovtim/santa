import { Inter, JetBrains_Mono, Playfair_Display } from "next/font/google";

// Шрифты скачиваются при сборке и отдаются с нашего домена (без запросов к Google из браузера).
// Начертаний — минимум: каждое лишнее — ещё файл на медленном мобильном интернете.

/** Заголовки: одно начертание 700. */
export const fontDisplay = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  weight: ["700"],
  variable: "--nf-display",
  display: "swap",
});

/**
 * Основной текст (вариативный шрифт: все жирности в одном файле на алфавит).
 * Без предзагрузки: иначе на медленном мобильном интернете он отнимает канал у картинки
 * первого экрана. Текст на долю секунды покажется системным шрифтом (display: swap).
 */
export const fontSans = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--nf-sans",
  display: "swap",
  preload: false,
  adjustFontFallback: true,
});

/** «Камерные» подписи: таймкод, REC, КАМЕРА 2. Мелкий декоративный текст — без предзагрузки. */
export const fontMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  // Без списка жирностей — вариативный шрифт: один файл на алфавит вместо двух.
  variable: "--nf-mono",
  display: "swap",
  preload: false,
});
