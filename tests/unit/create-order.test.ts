import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  upload: null as null | { key: string; orderId: string | null; createdAt: Date },
  object: null as null | { size: number; contentType: string },
  limits: { ok: true } as { ok: true } | { ok: false; reason: string },
  created: [] as Array<Record<string, unknown>>,
  jobs: [] as Array<{ name: string; data: unknown; opts: unknown }>,
}));

vi.mock("@/lib/db", () => {
  const tx = {
    order: {
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.created.push(data);
        return { id: "order-1", ...data };
      }),
    },
    upload: { updateMany: vi.fn(async () => ({ count: 1 })) },
  };
  return {
    db: {
      upload: { findUnique: vi.fn(async () => state.upload) },
      $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    },
  };
});
vi.mock("@/lib/s3", () => ({ headObject: vi.fn(async () => state.object) }));
vi.mock("@/lib/transition", () => ({ transition: vi.fn(async () => ({})) }));
vi.mock("@/lib/queue", () => ({
  QUEUE_PREVIEW: "preview",
  getQueue: () => ({
    add: vi.fn(async (name: string, data: unknown, opts: unknown) => state.jobs.push({ name, data, opts })),
  }),
}));
vi.mock("@/lib/limits", async (orig) => ({
  ...(await orig<typeof import("@/lib/limits")>()),
  checkOrderLimits: vi.fn(async () => state.limits),
}));
vi.mock("@/lib/redis", () => ({ redis: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: () => ({ IP_HASH_SALT: "s" }) }));

import { createOrder } from "@/lib/orders";

const KEY = "uploads/2026-11-17/6f1c2a8e-1b2c-4d3e-8f90-0123456789ab.jpg";
const input = { photoKey: KEY, email: "a@b.ru", consentPersonal: true as const, consentOffer: true as const };

describe("createOrder()", () => {
  beforeEach(() => {
    state.upload = { key: KEY, orderId: null, createdAt: new Date() };
    state.object = { size: 1_000_000, contentType: "image/jpeg" };
    state.limits = { ok: true };
    state.created = [];
    state.jobs = [];
  });

  it("цена берётся из конфига тарифа — 390 ₽", async () => {
    const r = await createOrder(input, "iphash");
    expect(r.ok).toBe(true);
    expect(state.created[0]).toMatchObject({ amountRub: 390, tariff: "camera_visit", email: "a@b.ru" });
  });

  it("подмена цены в запросе не влияет на сумму", async () => {
    const tampered = { ...input, amountRub: 1 } as typeof input;
    await createOrder(tampered, "iphash");
    expect(state.created[0].amountRub).toBe(390);
  });

  it("выключенный тариф заказать нельзя", async () => {
    const r = await createOrder({ ...input, tariff: "cinema" }, "iphash");
    expect(r).toMatchObject({ ok: false, code: "tariff" });
  });

  it("ставит задачу в очередь preview", async () => {
    await createOrder(input, "iphash");
    expect(state.jobs).toHaveLength(1);
    expect(state.jobs[0]).toMatchObject({ name: "preview", data: { orderId: "order-1" } });
  });

  it("чужая, старая или уже использованная загрузка — отказ", async () => {
    state.upload = null;
    expect(await createOrder(input, "h")).toMatchObject({ ok: false, code: "upload" });
    state.upload = { key: KEY, orderId: "other", createdAt: new Date() };
    expect(await createOrder(input, "h")).toMatchObject({ ok: false, code: "upload" });
    state.upload = { key: KEY, orderId: null, createdAt: new Date(Date.now() - 25 * 3600 * 1000) };
    expect(await createOrder(input, "h")).toMatchObject({ ok: false, code: "upload" });
  });

  it("файл не дошёл до хранилища или слишком большой — отказ", async () => {
    state.object = null;
    expect(await createOrder(input, "h")).toMatchObject({ ok: false, code: "upload" });
    state.object = { size: 16 * 1024 * 1024, contentType: "image/jpeg" };
    expect(await createOrder(input, "h")).toMatchObject({ ok: false, code: "upload" });
  });

  it("превышен лимит — 429, заказ не создаётся", async () => {
    state.limits = { ok: false, reason: "email_daily" };
    const r = await createOrder(input, "h");
    expect(r).toMatchObject({ ok: false, status: 429, code: "email_daily" });
    expect(state.created).toHaveLength(0);
    expect(state.jobs).toHaveLength(0);
  });
});
