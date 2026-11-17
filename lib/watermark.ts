/**
 * Водяной знак для кадра-превью: диагональная сетка надписей поверх уменьшенного кадра.
 * Чистый кадр отдаётся только после оплаты.
 */
import sharp from "sharp";

export const PREVIEW_WIDTH = 1280;

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function watermarkSvg(width: number, height: number, text = "ПРЕВЬЮ · ДЕД МОРОЗ") {
  const size = Math.max(18, Math.round(width / 28));
  const stepX = size * 14;
  const stepY = size * 4.2;
  const rows: string[] = [];
  // Сетка шире кадра: после поворота на −24° углы тоже закрыты.
  for (let y = -height; y < height * 2; y += stepY) {
    for (let x = -width; x < width * 2; x += stepX) {
      const shift = (Math.round(y / stepY) % 2) * (stepX / 2);
      rows.push(`<text x="${x + shift}" y="${y}">${escapeXml(text)}</text>`);
    }
  }
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <g transform="rotate(-24 ${width / 2} ${height / 2})"
         font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" font-size="${size}"
         fill="#ffffff" fill-opacity="0.28" stroke="#000000" stroke-opacity="0.18" stroke-width="1">
        ${rows.join("")}
      </g>
      <text x="${width / 2}" y="${height / 2 + size}" text-anchor="middle"
         font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" font-size="${size * 2.2}"
         fill="#ffffff" fill-opacity="0.42" stroke="#000" stroke-opacity="0.25" stroke-width="2">ПРЕВЬЮ</text>
    </svg>`,
  );
}

/** Уменьшает кадр до 1280 px по ширине и накладывает водяной знак. */
export async function makeWatermarkedPreview(frame: Buffer): Promise<Buffer> {
  const resized = await sharp(frame).rotate().resize({ width: PREVIEW_WIDTH, withoutEnlargement: true }).toBuffer();
  const { width = PREVIEW_WIDTH, height = 720 } = await sharp(resized).metadata();
  return sharp(resized)
    .composite([{ input: watermarkSvg(width, height), left: 0, top: 0 }])
    .jpeg({ quality: 80 })
    .toBuffer();
}
