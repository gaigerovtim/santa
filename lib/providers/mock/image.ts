/**
 * Заглушка редактирования кадра: через MOCK_IMAGE_DELAY_SEC возвращает загруженное фото
 * с наложенным силуэтом Деда Мороза и пометкой «ДЕМО».
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { env } from "@/lib/env";
import type { ImageEditProvider } from "../types";
import { MOCK_DIR, maybeFail, mockDelay } from "./common";

let silhouetteCache: Buffer | null = null;
async function silhouette(): Promise<Buffer> {
  silhouetteCache ??= await readFile(path.join(MOCK_DIR, "silhouette.png"));
  return silhouetteCache;
}

export function demoLabelSvg(width: number, height: number, text: string) {
  const size = Math.round(height * 0.06);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <text x="${width - size * 0.6}" y="${height - size * 0.7}" text-anchor="end"
        font-family="DejaVu Sans, Arial, sans-serif" font-weight="700" font-size="${size}"
        fill="#ffffff" fill-opacity="0.75" stroke="#000" stroke-opacity="0.4" stroke-width="2">${text}</text>
    </svg>`,
  );
}

/** Общая логика для mock и mock2 — отличаются только подписью. */
export async function overlayDemo(base: Buffer, label: string): Promise<Buffer> {
  const img = sharp(base).rotate();
  const { width = 1280, height = 720 } = await img.metadata();
  // Силуэт — около 55 % высоты кадра, справа от центра (обычно там стоит ёлка).
  const figureHeight = Math.round(height * 0.55);
  const figure = await sharp(await silhouette()).resize({ height: figureHeight }).png().toBuffer();
  const figureWidth = Math.round((figureHeight * 600) / 900);
  return img
    .composite([
      {
        input: figure,
        left: Math.max(0, Math.round(width * 0.58 - figureWidth / 2)),
        top: Math.max(0, height - figureHeight - Math.round(height * 0.08)),
      },
      { input: demoLabelSvg(width, height, label), left: 0, top: 0 },
    ])
    .jpeg({ quality: 88 })
    .toBuffer();
}

export const mockImageProvider: ImageEditProvider = {
  name: "mock",
  async editImage({ images }) {
    await mockDelay(env().MOCK_IMAGE_DELAY_SEC);
    maybeFail("кадра");
    if (!images.length) throw new Error("Нет исходного изображения");
    return { image: await overlayDemo(images[0], "ДЕМО"), costUsd: 0.04 };
  },
};
