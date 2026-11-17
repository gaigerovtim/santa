/**
 * Лимиты (ТЗ, «Лимиты и защита»):
 * - не больше 3 заказов на email в сутки;
 * - не больше 5 превью в час с одного IP (создание заказа и перегенерация);
 * - 1 превью + 1 перегенерация на заказ;
 * - ссылок на загрузку — не больше 30 в час с IP (защита хранилища от мусора).
 * IP не храним: только хеш с солью.
 */
import { createHash } from "node:crypto";
import { db } from "./db";
import { env } from "./env";
import { redis } from "./redis";

export const LIMITS = {
  ordersPerEmailPerDay: 3,
  previewsPerIpPerHour: 5,
  previewRegensPerOrder: 1,
  uploadUrlsPerIpPerHour: 30,
} as const;

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

export function hashIp(ip: string, salt = env().IP_HASH_SALT): string {
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

/** IP клиента из заголовков прокси; первый адрес в X-Forwarded-For — исходный. */
export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export type LimitResult = { ok: true } | { ok: false; reason: LimitReason };
export type LimitReason = "email_daily" | "ip_hourly" | "regen_used" | "upload_hourly";

export const LIMIT_MESSAGES: Record<LimitReason, string> = {
  email_daily: "С этого адреса уже создано 3 заказа за сутки. Попробуйте завтра или укажите другой email.",
  ip_hourly: "Слишком много кадров за час. Попробуйте немного позже.",
  regen_used: "Бесплатная перегенерация уже использована.",
  upload_hourly: "Слишком много загрузок за час. Попробуйте немного позже.",
};

/** Чистая проверка счётчика — отдельно, чтобы тестировать без базы. */
export function underLimit(count: number, max: number): boolean {
  return count < max;
}

/** Можно ли создать заказ: лимиты по email за сутки и по IP за час. */
export async function checkOrderLimits(
  email: string,
  ipHash: string,
  now = new Date(),
): Promise<LimitResult> {
  const [byEmail, previewsByIp] = await Promise.all([
    db.order.count({
      where: { email: normalizeEmail(email), createdAt: { gte: new Date(now.getTime() - DAY) } },
    }),
    countPreviewsByIp(ipHash, now),
  ]);
  if (!underLimit(byEmail, LIMITS.ordersPerEmailPerDay)) return { ok: false, reason: "email_daily" };
  if (!underLimit(previewsByIp, LIMITS.previewsPerIpPerHour)) return { ok: false, reason: "ip_hourly" };
  return { ok: true };
}

/** Превью за час с IP: созданные заказы + перегенерации (по истории статусов). */
export async function countPreviewsByIp(ipHash: string, now = new Date()): Promise<number> {
  const since = new Date(now.getTime() - HOUR);
  return db.orderEvent.count({
    where: {
      toStatus: "preview_generating",
      createdAt: { gte: since },
      order: { ipHash },
    },
  });
}

/** Скользящий счётчик в Redis для частых дешёвых операций (выдача ссылок на загрузку). */
export async function hitRateLimit(key: string, max: number, windowSec: number): Promise<boolean> {
  const r = redis();
  const k = `rl:${key}`;
  const count = await r.incr(k);
  if (count === 1) await r.expire(k, windowSec);
  return count <= max;
}
