/**
 * Нагрузочный тест (ТЗ): N заказов одновременно до статуса delivered без ошибок.
 * Каждый заказ проходит API как браузер: ссылка на загрузку → фото в хранилище → заказ →
 * кадр → тестовая оплата → видео (настоящий ffmpeg в воркере) → доставка.
 *
 *   docker compose up -d --build
 *   npm run test:load               # 20 заказов
 *   LOAD_ORDERS=50 npm run test:load
 */
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Redis } from "ioredis";

const BASE = process.env.LOAD_BASE_URL ?? "http://localhost:3000";
const N = Number(process.env.LOAD_ORDERS ?? 20);
const REDIS_URL = process.env.LOAD_REDIS_URL ?? "redis://localhost:6379";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin";
const TIMEOUT_MS = Number(process.env.LOAD_TIMEOUT_SEC ?? 600) * 1000;

type Step = "upload" | "order" | "preview" | "pay" | "delivered";

interface Result {
  n: number;
  ok: boolean;
  ms: number;
  steps: Partial<Record<Step, number>>;
  error?: string;
}

async function json(res: Response) {
  const body = await res.json().catch(() => null);
  if (!res.ok || body?.ok === false) throw new Error(`${res.status} ${JSON.stringify(body?.error ?? body)}`);
  return body;
}

async function adminCookie(): Promise<string> {
  const res = await fetch(`${BASE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", origin: BASE },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });
  await json(res);
  return (res.headers.get("set-cookie") ?? "").split(";")[0];
}

async function setManualApproval(cookie: string, value: boolean) {
  await json(
    await fetch(`${BASE}/api/admin/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", origin: BASE, cookie },
      body: JSON.stringify({ manualApproval: value }),
    }),
  );
}

async function waitStatus(token: string, want: string[], ip: string, deadline: number): Promise<string> {
  for (;;) {
    const { order } = await json(await fetch(`${BASE}/api/orders/${token}`, { headers: { "x-real-ip": ip } }));
    if (want.includes(order.status)) return order.status;
    if (order.status === "needs_help") throw new Error(`заказ ушёл в needs_help (ждали ${want.join("/")})`);
    if (Date.now() > deadline) throw new Error(`таймаут: статус ${order.status}, ждали ${want.join("/")}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

async function runOne(n: number, photo: Buffer, started: number): Promise<Result> {
  const t0 = Date.now();
  const steps: Result["steps"] = {};
  const mark = (s: Step) => (steps[s] = Date.now() - t0);
  const ip = `198.51.100.${(n % 250) + 1}`;
  const headers = { "Content-Type": "application/json", "x-real-ip": ip };
  const deadline = started + TIMEOUT_MS;
  try {
    const ticket = await json(
      await fetch(`${BASE}/api/upload-url`, {
        method: "POST",
        headers,
        body: JSON.stringify({ contentType: "image/jpeg", size: photo.length }),
      }),
    );
    const form = new FormData();
    for (const [k, v] of Object.entries(ticket.fields as Record<string, string>)) form.append(k, v);
    form.append("file", new Blob([new Uint8Array(photo)], { type: "image/jpeg" }), "room.jpg");
    const up = await fetch(ticket.url, { method: "POST", body: form });
    if (up.status !== 204) throw new Error(`хранилище ответило ${up.status}`);
    mark("upload");

    const { token } = await json(
      await fetch(`${BASE}/api/orders`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          photoKey: ticket.key,
          email: `load-${n}-${randomBytes(3).toString("hex")}@example.ru`,
          consentPersonal: true,
          consentOffer: true,
        }),
      }),
    );
    mark("order");

    await waitStatus(token, ["preview_ready"], ip, deadline);
    mark("preview");

    const { confirmationUrl } = await json(await fetch(`${BASE}/api/orders/${token}/pay`, { method: "POST", headers }));
    const paymentId = String(confirmationUrl).split("/").pop();
    await json(
      await fetch(`${BASE}/api/mock-pay/${paymentId}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ outcome: "succeeded" }),
      }),
    );
    mark("pay");

    await waitStatus(token, ["delivered"], ip, deadline);
    mark("delivered");
    return { n, ok: true, ms: Date.now() - t0, steps };
  } catch (err) {
    return { n, ok: false, ms: Date.now() - t0, steps, error: (err as Error).message };
  }
}

async function main() {
  const photo = await readFile(path.join(process.cwd(), "public", "media", "example-poster.jpg"));
  const redis = new Redis(REDIS_URL);
  const cookie = await adminCookie();

  // Реалистичные, но короткие задержки заглушек; видео доставляется без ручного одобрения.
  await redis.hset("mock:config", { image_delay: "2", video_delay: "5", failure_rate: "0" });
  await setManualApproval(cookie, false);

  console.log(`Нагрузочный тест: ${N} заказов одновременно → ${BASE}`);
  const started = Date.now();
  const results = await Promise.all(Array.from({ length: N }, (_, i) => runOne(i + 1, photo, started)));
  const total = Date.now() - started;

  await redis.del("mock:config");
  await setManualApproval(cookie, true);
  redis.disconnect();

  const ok = results.filter((r) => r.ok);
  const fail = results.filter((r) => !r.ok);
  const sec = (ms?: number) => (ms === undefined ? "—" : (ms / 1000).toFixed(1));
  console.log("\n  №   загрузка  заказ  кадр  оплата  доставлен");
  for (const r of results.sort((a, b) => a.n - b.n)) {
    console.log(
      `${String(r.n).padStart(3)}  ${sec(r.steps.upload).padStart(8)} ${sec(r.steps.order).padStart(6)} ${sec(r.steps.preview).padStart(5)} ${sec(r.steps.pay).padStart(7)} ${sec(r.steps.delivered).padStart(10)}${r.error ? "  ✗ " + r.error : ""}`,
    );
  }
  const times = ok.map((r) => r.ms).sort((a, b) => a - b);
  console.log(`\nУспешно: ${ok.length}/${N}, ошибок: ${fail.length}. Всё заняло ${sec(total)} с.`);
  if (times.length) {
    console.log(`До доставки: медиана ${sec(times[Math.floor(times.length / 2)])} с, максимум ${sec(times[times.length - 1])} с.`);
  }
  process.exitCode = fail.length ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
