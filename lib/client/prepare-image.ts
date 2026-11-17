/**
 * Подготовка фото в браузере перед загрузкой:
 * - HEIC/HEIF (айфоны) → JPG (конвертер подгружается только при необходимости);
 * - поворот по EXIF;
 * - уменьшение до 2560 px по длинной стороне;
 * - перекодирование в JPEG — заодно удаляются метаданные, в том числе геолокация.
 */
import { isHeicLike, isPortrait } from "@/lib/upload-rules";

const MAX_SIDE = 2560;
const JPEG_QUALITY = 0.9;

export interface PreparedImage {
  blob: Blob;
  width: number;
  height: number;
  portrait: boolean;
  previewUrl: string;
}

export class PrepareImageError extends Error {}

async function decode(file: File): Promise<ImageBitmap> {
  if (isHeicLike(file)) {
    try {
      const { heicTo } = await import("heic-to/next");
      return await heicTo({ blob: file, type: "bitmap", options: { imageOrientation: "from-image" } });
    } catch {
      throw new PrepareImageError("Не получилось открыть HEIC. Попробуйте выбрать фото в формате JPG");
    }
  }
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PrepareImageError("Не получилось открыть фото. Попробуйте другой файл");
  }
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  const bitmap = await decode(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PrepareImageError("Браузер не смог обработать фото");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) throw new PrepareImageError("Браузер не смог обработать фото");

  return {
    blob,
    width,
    height,
    portrait: isPortrait(width, height),
    previewUrl: URL.createObjectURL(blob),
  };
}
