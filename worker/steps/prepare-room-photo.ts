/**
 * Шаг prepareRoomPhoto: приводит фото комнаты к кадру 16:9, 1920×1080.
 * Горизонтальное фото обрезается по центру до 16:9; вертикальное или квадратное
 * вписывается целиком на размытый фон из самого фото — ёлка не обрезается.
 */
import sharp from "sharp";

export const FRAME_W = 1920;
export const FRAME_H = 1080;

export async function prepareRoomPhoto(input: Buffer): Promise<Buffer> {
  const source = sharp(input).rotate();
  const { width = 0, height = 0 } = await source.metadata();
  if (!width || !height) throw new Error("Не удалось прочитать размеры фото");

  const ratio = width / height;
  if (ratio >= 1.25) {
    // Горизонтальное: заполнить 16:9 с обрезкой по центру
    return source
      .resize(FRAME_W, FRAME_H, { fit: "cover", position: "centre" })
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  // Вертикальное/квадратное: размытый фон + фото целиком по центру
  const background = await sharp(input)
    .rotate()
    .resize(FRAME_W, FRAME_H, { fit: "cover" })
    .blur(40)
    .modulate({ brightness: 0.55 })
    .toBuffer();
  const foreground = await sharp(input).rotate().resize(FRAME_W, FRAME_H, { fit: "inside" }).toBuffer();
  const meta = await sharp(foreground).metadata();
  return sharp(background)
    .composite([
      {
        input: foreground,
        left: Math.round((FRAME_W - (meta.width ?? FRAME_W)) / 2),
        top: Math.round((FRAME_H - (meta.height ?? FRAME_H)) / 2),
      },
    ])
    .jpeg({ quality: 90 })
    .toBuffer();
}
