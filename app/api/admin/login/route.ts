import { cookies } from "next/headers";
import { z } from "zod";
import { env } from "@/lib/env";
import { jsonError, readJson } from "@/lib/http";
import { clientIp, hashIp, hitRateLimit } from "@/lib/limits";
import {
  ADMIN_COOKIE,
  SESSION_TTL_SEC,
  adminConfigured,
  createSessionToken,
  passwordMatches,
  sameOrigin,
} from "@/lib/admin-session";

const schema = z.object({ password: z.string().min(1).max(200) });

/** Вход в админку: пароль из ADMIN_PASSWORD, не больше 10 попыток за 15 минут с IP. */
export async function POST(req: Request) {
  const e = env();
  if (!adminConfigured(e.ADMIN_PASSWORD, e.SESSION_SECRET)) {
    return jsonError(503, "admin_disabled", "Админка не настроена: задайте ADMIN_PASSWORD и SESSION_SECRET (от 32 символов)");
  }
  if (!sameOrigin(req)) return jsonError(403, "origin", "Запрос с чужого сайта");
  if (!(await hitRateLimit(`admin-login:${hashIp(clientIp(req.headers))}`, 10, 15 * 60))) {
    return jsonError(429, "rate_limit", "Слишком много попыток. Подождите 15 минут");
  }

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success || !passwordMatches(parsed.data.password, e.ADMIN_PASSWORD)) {
    return jsonError(401, "wrong_password", "Неверный пароль");
  }

  (await cookies()).set(ADMIN_COOKIE, createSessionToken(e.SESSION_SECRET), {
    httpOnly: true,
    sameSite: "strict",
    secure: new URL(req.url).protocol === "https:",
    path: "/",
    maxAge: SESSION_TTL_SEC,
  });
  return Response.json({ ok: true });
}
