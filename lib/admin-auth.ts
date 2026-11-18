/** Проверка доступа к админке для страниц и API. */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { env } from "./env";
import { jsonError } from "./http";
import { ADMIN_COOKIE, adminConfigured, sameOrigin, verifySessionToken } from "./admin-session";

export async function isAdmin(): Promise<boolean> {
  // Проверка срока сессии использует текущее время — только при запросе, не при сборке.
  await connection();
  const e = env();
  if (!adminConfigured(e.ADMIN_PASSWORD, e.SESSION_SECRET)) return false;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return verifySessionToken(token, e.SESSION_SECRET);
}

/** Для страниц: без сессии — на страницу входа. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

/** Для API: null — доступ есть, иначе готовый ответ с ошибкой. */
export async function requireAdminApi(req: Request): Promise<Response | null> {
  if (req.method !== "GET" && !sameOrigin(req)) return jsonError(403, "origin", "Запрос с чужого сайта");
  if (!(await isAdmin())) return jsonError(401, "unauthorized", "Нужно войти в админку");
  return null;
}
