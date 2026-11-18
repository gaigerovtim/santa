/**
 * Критерии приёмки по защите, проверенные прямыми запросами:
 * цену нельзя подменить; чистый кадр и видео недоступны до оплаты; админка закрыта.
 */
import { readFile } from "node:fs/promises";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { randomIp, ROOM_PHOTO } from "./helpers";

// Проверки API одинаковы для телефона и компьютера — гоняем один раз.
test.skip(({ browserName }) => browserName !== "chromium", "API-проверки — один раз");

async function createOrder(api: APIRequestContext, extra: Record<string, unknown> = {}) {
  const ticket = await (await api.post("/api/upload-url", { data: { contentType: "image/jpeg", size: 30_000 } })).json();
  expect(ticket.ok).toBeTruthy();
  // В хранилище — обычной формой, как браузер, без X-Real-IP (его добавляет только прокси перед сайтом).
  const form = new FormData();
  for (const [k, v] of Object.entries(ticket.fields as Record<string, string>)) form.append(k, v);
  form.append("file", new Blob([new Uint8Array(await readFile(ROOM_PHOTO))], { type: "image/jpeg" }), "room.jpg");
  const upload = await fetch(ticket.url, { method: "POST", body: form });
  expect(upload.status).toBe(204);
  const res = await api.post("/api/orders", {
    data: {
      photoKey: ticket.key,
      email: `sec-${randomBytes(4).toString("hex")}@example.ru`,
      consentPersonal: true,
      consentOffer: true,
      ...extra,
    },
  });
  return { res, body: await res.json() };
}

test.describe("защита", () => {
  test.use({ extraHTTPHeaders: { "x-real-ip": randomIp("198.19") } });

  test("цену нельзя подменить из браузера", async ({ request }) => {
    const { res, body } = await createOrder(request, { amountRub: 1, priceRub: 1, tariff: "camera_visit" });
    expect(res.status()).toBe(201);
    const order = (await (await request.get(`/api/orders/${body.token}`)).json()).order;
    expect(order.amountRub).toBe(390);
  });

  test("выключенный тариф заказать нельзя", async ({ request }) => {
    const { res } = await createOrder(request, { tariff: "cinema" });
    expect(res.status()).toBe(400);
  });

  test("до оплаты — только превью с водяным знаком; чистый кадр по прямой ссылке закрыт", async ({ request }) => {
    const { body } = await createOrder(request);
    await expect
      .poll(async () => (await (await request.get(`/api/orders/${body.token}`)).json()).order.status, { timeout: 30_000 })
      .toBe("preview_ready");
    const order = (await (await request.get(`/api/orders/${body.token}`)).json()).order;
    expect(order.previewUrl).toContain("preview.jpg");
    expect(order.frameUrl).toBeNull();
    expect(order.videoUrl).toBeNull();
    expect(order.downloadUrl).toBeNull();

    // Угадали путь к чистому кадру — хранилище без подписи не отдаёт; само превью без подписи тоже
    const cleanGuess = order.previewUrl.split("?")[0].replace("preview.jpg", "frameA.jpg");
    expect((await fetch(cleanGuess)).status).toBe(403);
    expect((await fetch(order.previewUrl.split("?")[0])).status).toBe(403);
    // А по подписанной ссылке превью открывается
    expect((await fetch(order.previewUrl)).status).toBe(200);
  });

  test("оплатить чужой заказ поддельным уведомлением нельзя", async ({ request }) => {
    const { body } = await createOrder(request);
    const res = await request.post("/api/payments/webhook", {
      data: { type: "notification", event: "payment.succeeded", object: { id: "fake_payment", status: "succeeded" } },
    });
    expect((await res.json()).result).toMatchObject({ handled: false });
    const order = (await (await request.get(`/api/orders/${body.token}`)).json()).order;
    expect(order.status).not.toBe("paid");
  });

  test("админка закрыта без входа", async ({ request }) => {
    const res = await request.post("/api/admin/settings", {
      data: { manualApproval: false },
      headers: { origin: test.info().project.use.baseURL ?? "http://localhost:3000" },
    });
    expect(res.status()).toBe(401);
  });
});
