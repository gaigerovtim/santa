/**
 * Создаёт файлы-заглушки для mock-провайдеров:
 *   assets/mock/silhouette.png    — силуэт Деда Мороза на прозрачном фоне
 *   assets/mock/frame-example.jpg — пример кадра (если нет своего)
 * Запуск: npx tsx scripts/make-mock-assets.ts
 * Свои файлы с теми же именами можно положить вместо сгенерированных.
 */
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const dir = path.join(process.cwd(), "assets", "mock");

// Силуэт: шапка с помпоном, борода, шуба с поясом, посох, мешок. Тёмно-красный с подсветкой краёв.
const silhouetteSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
  <defs>
    <linearGradient id="coat" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#b3132c"/><stop offset="1" stop-color="#6e0a1a"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g filter="url(#glow)" opacity="0.92">
    <!-- посох -->
    <rect x="470" y="150" width="16" height="720" rx="8" fill="#c9b48a"/>
    <circle cx="478" cy="140" r="26" fill="#e8f2ff" opacity="0.85"/>
    <!-- мешок -->
    <path d="M70 560 C 30 640, 40 820, 160 840 C 250 850, 270 700, 220 600 C 190 540, 110 520, 70 560 Z" fill="#7a5a3a"/>
    <!-- шуба -->
    <path d="M190 330 C 150 420, 130 620, 120 860 L 450 860 C 440 620, 420 420, 380 330 Z" fill="url(#coat)"/>
    <rect x="118" y="830" width="334" height="34" rx="12" fill="#f3efe6"/>
    <rect x="290" y="340" width="22" height="500" fill="#f3efe6" opacity="0.9"/>
    <rect x="160" y="560" width="250" height="26" rx="6" fill="#3a0610"/>
    <!-- рукава -->
    <path d="M200 360 C 150 420, 130 520, 160 600 L 200 590 C 190 520, 210 450, 230 400 Z" fill="#9a1026"/>
    <path d="M380 360 C 430 410, 460 470, 470 520 L 440 540 C 420 490, 400 450, 360 410 Z" fill="#9a1026"/>
    <!-- голова, борода -->
    <circle cx="300" cy="230" r="70" fill="#e9c9a8"/>
    <path d="M220 240 C 220 380, 380 380, 380 240 C 360 300, 240 300, 220 240 Z" fill="#f5f2ea"/>
    <path d="M215 250 C 200 420, 400 420, 385 250 C 370 340, 230 340, 215 250 Z" fill="#ffffff"/>
    <!-- шапка -->
    <path d="M222 205 C 230 120, 300 90, 370 120 C 400 135, 410 160, 382 205 Z" fill="#b3132c"/>
    <rect x="215" y="190" width="172" height="34" rx="16" fill="#f3efe6"/>
    <circle cx="380" cy="118" r="20" fill="#f3efe6"/>
  </g>
</svg>`;

async function main() {
  await mkdir(dir, { recursive: true });

  const silhouette = path.join(dir, "silhouette.png");
  await sharp(Buffer.from(silhouetteSvg)).png().toFile(silhouette);
  console.log("Создан", path.relative(process.cwd(), silhouette));

  const example = path.join(dir, "frame-example.jpg");
  if (!existsSync(example)) {
    const poster = path.join(process.cwd(), "public", "media", "example-poster.jpg");
    await sharp(poster).jpeg({ quality: 85 }).toFile(example);
    console.log("Создан", path.relative(process.cwd(), example));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
