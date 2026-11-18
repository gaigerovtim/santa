import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  order: { id: "o1", status: "preview_ready", amountRub: 390 } as { id: string; status: string; amountRub: number },
  payment: { status: "succeeded", amountRub: 390, orderId: "o1" } as {
    status: "pending" | "succeeded" | "canceled";
    amountRub: number;
    orderId: string;
  } | null,
  transitions: [] as string[],
  jobs: [] as Array<{ data: unknown; opts: { jobId: string } }>,
  updates: [] as unknown[],
}));

vi.mock("@/lib/db", () => ({
  db: {
    order: {
      findUnique: vi.fn(async () => state.order),
      update: vi.fn(async (args: unknown) => state.updates.push(args)),
    },
  },
}));
vi.mock("@/lib/providers", () => ({
  getPaymentProvider: async () => ({
    name: "mock",
    verifyPayment: async () => {
      if (!state.payment) throw new Error("нет платежа");
      return state.payment;
    },
  }),
}));
// Упрощённый transition: условный переход, повтор с allowSame — null.
vi.mock("@/lib/transition", () => ({
  transition: vi.fn(async (_id: string, to: string, opts: { allowSame?: boolean }) => {
    if (state.order.status === to && opts.allowSame) return null;
    if (state.order.status !== "preview_ready") throw new Error(`Недопустимый переход ${state.order.status} → ${to}`);
    state.order.status = to;
    state.transitions.push(to);
    return { ...state.order };
  }),
}));
vi.mock("@/lib/queue", () => ({
  QUEUE_VIDEO: "video",
  getQueue: () => ({ add: vi.fn(async (_n: string, data: unknown, opts: { jobId: string }) => state.jobs.push({ data, opts })) }),
}));
vi.mock("@/lib/env", () => ({ env: () => ({ NODE_ENV: "test", APP_URL: "http://localhost:3000" }) }));
const mails = vi.hoisted(() => ({ paid: 0 }));
vi.mock("@/lib/notify", () => ({ notifyPaid: vi.fn(async () => { mails.paid++; return true; }) }));

import { buildNotification, handlePaymentNotification } from "@/lib/payments";

const succeeded = buildNotification({ paymentId: "mock_1", status: "succeeded", amountRub: 390, orderId: "o1" });

describe("webhook оплаты", () => {
  beforeEach(() => {
    state.order = { id: "o1", status: "preview_ready", amountRub: 390 };
    state.payment = { status: "succeeded", amountRub: 390, orderId: "o1" };
    state.transitions = [];
    state.jobs = [];
    state.updates = [];
    mails.paid = 0;
  });

  it("оплата → статус paid и задача в очередь video", async () => {
    const r = await handlePaymentNotification(succeeded);
    expect(r).toEqual({ handled: true, action: "paid", orderId: "o1" });
    expect(state.transitions).toEqual(["paid"]);
    expect(state.jobs).toEqual([{ data: { orderId: "o1" }, opts: expect.objectContaining({ jobId: "video-o1" }) }]);
  });

  it("повторное уведомление ничего не меняет", async () => {
    await handlePaymentNotification(succeeded);
    const again = await handlePaymentNotification(succeeded);
    expect(again).toEqual({ handled: true, action: "already_paid", orderId: "o1" });
    expect(state.transitions).toEqual(["paid"]);
    expect(state.jobs).toHaveLength(1);
    expect(mails.paid).toBe(1); // письмо «Заказ оплачен» — одно, несмотря на повтор
  });

  it("поддельное уведомление: тело говорит «оплачено», провайдер — нет", async () => {
    state.payment = { status: "pending", amountRub: 390, orderId: "o1" };
    const r = await handlePaymentNotification(succeeded);
    expect(r).toEqual({ handled: false, reason: "not_succeeded" });
    expect(state.order.status).toBe("preview_ready");
    expect(state.jobs).toHaveLength(0);
  });

  it("неизвестный платёж — заказ не трогаем", async () => {
    state.payment = null;
    expect(await handlePaymentNotification(succeeded)).toEqual({ handled: false, reason: "unknown_payment" });
    expect(state.transitions).toHaveLength(0);
  });

  it("сумма в теле уведомления не важна — сверяется сумма у провайдера с заказом", async () => {
    const tampered = buildNotification({ paymentId: "mock_1", status: "succeeded", amountRub: 1, orderId: "o1" });
    expect((await handlePaymentNotification(tampered)).handled).toBe(true);
    state.order = { id: "o1", status: "preview_ready", amountRub: 390 };
    state.payment = { status: "succeeded", amountRub: 1, orderId: "o1" };
    state.transitions = [];
    expect(await handlePaymentNotification(succeeded)).toEqual({ handled: false, reason: "amount_mismatch" });
    expect(state.transitions).toHaveLength(0);
  });

  it("отказ от оплаты — заказ остаётся в preview_ready", async () => {
    state.payment = { status: "canceled", amountRub: 390, orderId: "o1" };
    const canceled = buildNotification({ paymentId: "mock_1", status: "canceled", amountRub: 390, orderId: "o1" });
    expect(await handlePaymentNotification(canceled)).toEqual({ handled: true, action: "canceled", orderId: "o1" });
    expect(state.order.status).toBe("preview_ready");
  });

  it("оплата пришла для истёкшего заказа — ошибка записывается, статус не меняется", async () => {
    state.order = { id: "o1", status: "expired", amountRub: 390 };
    expect(await handlePaymentNotification(succeeded)).toEqual({ handled: false, reason: "wrong_status" });
    expect(state.updates).toHaveLength(1);
    expect(state.jobs).toHaveLength(0);
  });

  it("мусор вместо уведомления — invalid_body; чужие события — игнорируем", async () => {
    expect(await handlePaymentNotification({ hello: 1 })).toEqual({ handled: false, reason: "invalid_body" });
    expect(await handlePaymentNotification({ type: "notification", event: "refund.succeeded", object: { id: "r1" } })).toEqual({
      handled: true,
      action: "ignored",
    });
  });

  it("формат уведомления как у ЮKassa", () => {
    expect(succeeded).toMatchObject({
      type: "notification",
      event: "payment.succeeded",
      object: { id: "mock_1", status: "succeeded", amount: { value: "390.00", currency: "RUB" } },
    });
  });
});
