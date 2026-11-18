/**
 * Сессия администратора в подписанной cookie (ТЗ): payload с сроком действия + HMAC-SHA256
 * на SESSION_SECRET. Без базы и без серверных зависимостей — тестируется отдельно.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "admin_session";
export const SESSION_TTL_SEC = 12 * 3600;

function sign(data: string, secret: string) {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function createSessionToken(secret: string, now = Date.now(), ttlSec = SESSION_TTL_SEC): string {
  const payload = Buffer.from(JSON.stringify({ role: "admin", exp: Math.floor(now / 1000) + ttlSec })).toString(
    "base64url",
  );
  return `${payload}.${sign(payload, secret)}`;
}

export function verifySessionToken(token: string | undefined, secret: string, now = Date.now()): boolean {
  if (!token || !secret) return false;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return false;
  if (!safeEqual(signature, sign(payload, secret))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data?.role === "admin" && typeof data.exp === "number" && data.exp * 1000 > now;
  } catch {
    return false;
  }
}

/** Сравнение пароля за постоянное время (через HMAC — длина не утекает). */
export function passwordMatches(input: string, expected: string): boolean {
  if (!expected) return false;
  const key = "admin-password-compare";
  return safeEqual(sign(input, key), sign(expected, key));
}

/** Админка выключена, если пароль не задан или ключ подписи слишком короткий. */
export function adminConfigured(password: string, secret: string): boolean {
  return password.length > 0 && secret.length >= 32;
}

/** Защита от CSRF: POST-запросы админки принимаем только со своего сайта. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(req.url).host || new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}
