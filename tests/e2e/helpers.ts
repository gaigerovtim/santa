/** Общие помощники e2e: настройки заглушек, ручное одобрение, уникальные IP и email, Mailpit. */
import { randomBytes, randomInt } from "node:crypto";
import path from "node:path";
import { expect, request, type Page } from "@playwright/test";
import { Redis } from "ioredis";

export const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
export const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? "http://localhost:8025";
export const REDIS_URL = process.env.E2E_REDIS_URL ?? "redis://localhost:6379";
/** Тестовый пароль из .env.example; на стенде можно переопределить. */
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "admin";
export const ROOM_PHOTO = path.join(process.cwd(), "public", "media", "example-poster.jpg");

/** Настройки заглушек на лету (lib/providers/mock/common.ts). */
export async function setMockConfig(cfg: { image_delay?: number; video_delay?: number; failure_rate?: number }) {
  const r = new Redis(REDIS_URL);
  try {
    const entries = Object.entries(cfg).map(([k, v]) => [k, String(v)]);
    if (entries.length) await r.hset("mock:config", Object.fromEntries(entries));
  } finally {
    r.disconnect();
  }
}

export async function clearMockConfig() {
  const r = new Redis(REDIS_URL);
  try {
    await r.del("mock:config");
  } finally {
    r.disconnect();
  }
}

/** Ручное одобрение через API админки — так же, как переключателем. */
export async function setManualApproval(value: boolean) {
  // Свой «IP» на каждый служебный вход — иначе упрёмся в лимит 10 входов за 15 минут.
  const ctx = await request.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { origin: BASE_URL, "x-real-ip": randomIp("198.20") },
  });
  try {
    const login = await ctx.post("/api/admin/login", { data: { password: ADMIN_PASSWORD } });
    expect(login.ok(), `вход в админку: ${await login.text()}`).toBeTruthy();
    const res = await ctx.post("/api/admin/settings", { data: { manualApproval: value } });
    expect(res.ok()).toBeTruthy();
  } finally {
    await ctx.dispose();
  }
}

/**
 * Каждому тесту — свой «IP» и email, чтобы не упираться в лимиты (5 превью в час, 3 заказа на email).
 * Заголовок X-Real-IP добавляется только к запросам к сайту (как это делает nginx) —
 * хранилище запрос с посторонним заголовком отклоняет.
 */
export async function freshIdentity(page: Page) {
  const ip = randomIp("198.18");
  const origin = new URL(BASE_URL).origin;
  await page.route(
    (url) => url.origin === origin,
    (route) => route.continue({ headers: { ...route.request().headers(), "x-real-ip": ip } }),
  );
  return { ip, email: `e2e-${randomBytes(4).toString("hex")}@example.ru` };
}

export function randomIp(prefix: string) {
  return `${prefix}.${randomInt(0, 255)}.${randomInt(1, 254)}`;
}

/** Проходит форму /create до страницы заказа. Возвращает токен заказа. */
export async function createOrderViaUi(page: Page, email: string): Promise<string> {
  // Если уже пришли на /create кликом с главной — второй переход прервал бы первый.
  if (new URL(page.url()).pathname !== "/create") await page.goto("/create");
  const fileInput = page.locator('input[type="file"]');
  await fileInput.waitFor({ state: "attached" });
  await fileInput.setInputFiles(ROOM_PHOTO);
  const next = page.getByRole("button", { name: "Дальше" });
  await expect(next).toBeEnabled();
  await next.click();

  await page.getByLabel("Email").fill(email);
  await page.getByRole("checkbox", { name: /обработку персональных данных/ }).check();
  await page.getByRole("checkbox", { name: /Принимаю условия/ }).check();
  await page.getByRole("button", { name: "Показать кадр бесплатно" }).click();

  await page.waitForURL(/\/order\/[A-Za-z0-9_-]{32,}/);
  return page.url().split("/order/")[1].split("?")[0];
}

/** Оплата на странице «Тестовая оплата». */
export async function payViaMock(page: Page, outcome: "Оплатить" | "Отказаться" = "Оплатить") {
  await page.getByRole("button", { name: /Оплатить \d+ ₽ и получить видео/ }).click();
  await page.waitForURL(/\/mock-pay\//);
  await expect(page.getByRole("heading", { name: "Тестовая оплата" })).toBeVisible();
  await page.getByRole("button", { name: outcome === "Оплатить" ? /^Оплатить \d+ ₽$/ : "Отказаться" }).click();
  await page.waitForURL(/\/order\//);
}

/** Письма в Mailpit для адреса. */
export async function mailsFor(email: string): Promise<string[]> {
  const res = await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`);
  const data = (await res.json()) as { messages: Array<{ Subject: string }> };
  return data.messages.map((m) => m.Subject);
}
