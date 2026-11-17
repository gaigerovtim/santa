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

/** Основной текст (вариативный шрифт: все жирности в одном файле на алфавит). */
export const fontSans = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--nf-sans",
  display: "swap",
});

/** «Камерные» подписи: таймкод, REC, КАМЕРА 2. Мелкий декоративный текст — без предзагрузки. */
export const fontMono = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600"],
  variable: "--nf-mono",
  display: "swap",
  preload: false,
});
