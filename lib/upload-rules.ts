/**
 * Правила загрузки фото — общие для браузера и сервера (без серверных зависимостей).
 */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/** Что принимает хранилище. HEIC браузер сначала переводит в JPG. */
export const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type AllowedUploadType = (typeof ALLOWED_UPLOAD_TYPES)[number];

/** Что можно выбрать в форме (включая HEIC/HEIF с айфонов). */
export const ACCEPTED_INPUT_TYPES = [...ALLOWED_UPLOAD_TYPES, "image/heic", "image/heif"];
export const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif)$/i;

export const EXTENSION_BY_TYPE: Record<AllowedUploadType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function isAllowedUploadType(type: string): type is AllowedUploadType {
  return (ALLOWED_UPLOAD_TYPES as readonly string[]).includes(type);
}

export function isHeicLike(file: { type: string; name: string }) {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

/** Фото «вертикальное», если высота заметно больше ширины. */
export function isPortrait(width: number, height: number) {
  return height > width * 1.05;
}
