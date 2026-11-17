import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { jsonError, readJson } from "@/lib/http";
import { LIMIT_MESSAGES, LIMITS, clientIp, hashIp, hitRateLimit } from "@/lib/limits";
import { presignUpload } from "@/lib/s3";
import { uploadUrlSchema } from "@/lib/schemas";
import { EXTENSION_BY_TYPE, MAX_UPLOAD_BYTES } from "@/lib/upload-rules";

/** Выдаёт подписанную форму для загрузки фото комнаты прямо в хранилище. */
export async function POST(req: Request) {
  if (!env().ORDERS_ENABLED) return jsonError(503, "orders_disabled", "Приём заказов временно закрыт");

  const parsed = uploadUrlSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return jsonError(400, "invalid_file", "Подойдёт фото JPG, PNG, WEBP или HEIC до 15 МБ");
  }

  const ipHash = hashIp(clientIp(req.headers));
  if (!(await hitRateLimit(`upload:${ipHash}`, LIMITS.uploadUrlsPerIpPerHour, 3600))) {
    return jsonError(429, "upload_hourly", LIMIT_MESSAGES.upload_hourly);
  }

  const { contentType } = parsed.data;
  const day = new Date().toISOString().slice(0, 10);
  const key = `uploads/${day}/${randomUUID()}.${EXTENSION_BY_TYPE[contentType]}`;

  const post = await presignUpload({ key, contentType, maxBytes: MAX_UPLOAD_BYTES });
  await db.upload.create({ data: { key, ipHash } });

  return Response.json({ ok: true, key, url: post.url, fields: post.fields });
}
