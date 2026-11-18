import { beforeEach, describe, expect, it, vi } from "vitest";

const s = vi.hoisted(() => ({
  order: null as null | Record<string, unknown>,
  transitions: [] as string[],
  refunds: [] as Array<[string, number]>,
  delivered: 0,
  mails: [] as string[],
  jobs: [] as string[],
  events: 0,
}));

vi.mock("@/lib/db", () => ({
  db: {
    order: { findUnique: vi.fn(async () => s.order) },
    orderEvent: { create: vi.fn(async () => s.events++) },
  },
}));
vi.mock("@/lib/transition", () => ({
  transition: vi.fn(async (_id: string, to: string) => {
    s.transitions.push(to);
    return { ...s.order, status: to };
  }),
}));
vi.mock("@/lib/delivery", () => ({ deliverOrder: vi.fn(async () => s.delivered++) }));
vi.mock("@/lib/notify", () => ({
  notify: vi.fn(async (kind: string) => {
    s.mails.push(kind);
    return true;
  }),
}));
vi.mock("@/lib/providers", () => ({
  getPaymentProvider: async () => ({ name: "mock", refund: async (id: string, amount: number) => s.refunds.push([id, amount]) }),
}));
vi.mock("@/lib/video-queue", () => ({ requeueVideo: vi.fn(async () => s.jobs.push("video")) }));
vi.mock("@/lib/queue", () => ({ QUEUE_PREVIEW: "preview", getQueue: () => ({ add: async () => s.jobs.push("preview") }) }));

import { availableActions, resendKind, runAdminAction } from "@/lib/admin-actions";
import {
  adminConfigured,
  createSessionToken,
  passwordMatches,
  sameOrigin,
  verifySessionToken,
} from "@/lib/admin-session";

const SECRET = "x".repeat(32);

describe("сессия администратора", () => {
  it("подписанная cookie проходит проверку", () => {
    expect(verifySessionToken(createSessionToken(SECRET), SECRET)).toBe(true);
  });

  it("подделка подписи, чужой ключ и мусор — отказ", () => {
    const token = createSessionToken(SECRET);
    const [payload] = token.split(".");
    expect(verifySessionToken(`${payload}.AAAA`, SECRET)).toBe(false);
    expect(verifySessionToken(token, "y".repeat(32))).toBe(false);
    expect(verifySessionToken("garbage", SECRET)).toBe(false);
    expect(verifySessionToken(undefined, SECRET)).toBe(false);
    // payload с бесконечным сроком, но без правильной подписи
    const forged = Buffer.from(JSON.stringify({ role: "admin", exp: 9e9 })).toString("base64url");
    expect(verifySessionToken(`${forged}.${token.split(".")[1]}`, SECRET)).toBe(false);
  });

  it("истёкшая сессия — отказ", () => {
    const token = createSessionToken(SECRET, Date.now() - 13 * 3600 * 1000);
    expect(verifySessionToken(token, SECRET)).toBe(false);
  });

  it("пароль сравнивается точно; пустой пароль в .env — админка выключена", () => {
    expect(passwordMatches("secret", "secret")).toBe(true);
    expect(passwordMatches("secreT", "secret")).toBe(false);
    expect(passwordMatches("", "")).toBe(false);
    expect(adminConfigured("", SECRET)).toBe(false);
    expect(adminConfigured("pass", "short")).toBe(false);
    expect(adminConfigured("pass", SECRET)).toBe(true);
  });

  it("POST с чужого сайта отклоняется (CSRF)", () => {
    const req = (origin?: string) =>
      new Request("http://localhost:3000/api/admin/settings", {
        method: "POST",
        headers: origin ? { origin } : {},
      });
    expect(sameOrigin(req("http://localhost:3000"))).toBe(true);
    expect(sameOrigin(req("https://evil.example"))).toBe(false);
    expect(sameOrigin(req())).toBe(false);
  });
});

const paid = { paidAt: new Date(), paymentId: "mock_1", artifacts: { final: "orders/o/final.mp4" } };
const unpaid = { paidAt: null, paymentId: null, artifacts: {} };

describe("действия администратора: что доступно", () => {
  it("на одобрении — одобрить, перегенерировать, вернуть, письмо", () => {
    expect(availableActions({ status: "review", ...paid })).toEqual(["approve", "regenerate", "refund", "resend"]);
  });

  it("доставлен — без «Одобрить»", () => {
    expect(availableActions({ status: "delivered", ...paid })).toEqual(["regenerate", "refund", "resend"]);
  });

  it("неоплаченный сбой превью — только перегенерировать кадр и письмо", () => {
    expect(availableActions({ status: "needs_help", ...unpaid })).toEqual(["regenerate", "resend"]);
  });

  it("возврат — только для оплаченного; после возврата — ничего", () => {
    expect(availableActions({ status: "preview_ready", ...unpaid })).not.toContain("refund");
    expect(availableActions({ status: "refunded", ...paid })).toEqual([]);
    expect(availableActions({ status: "expired", ...unpaid })).toEqual([]);
  });

  it("какое письмо отправлять повторно", () => {
    expect(resendKind("delivered")).toBe("ready");
    expect(resendKind("review")).toBe("paid");
    expect(resendKind("needs_help")).toBe("delayed");
    expect(resendKind("preview_ready")).toBeNull();
  });
});

describe("действия администратора: выполнение", () => {
  beforeEach(() => {
    Object.assign(s, { transitions: [], refunds: [], delivered: 0, mails: [], jobs: [], events: 0 });
  });

  it("одобрить → доставка с письмом", async () => {
    s.order = { id: "o1", status: "review", amountRub: 390, ...paid };
    expect((await runAdminAction("o1", "approve")).ok).toBe(true);
    expect(s.delivered).toBe(1);
  });

  it("вернуть деньги → refund у провайдера на сумму заказа и статус refunded", async () => {
    s.order = { id: "o1", status: "delivered", amountRub: 390, ...paid };
    expect((await runAdminAction("o1", "refund")).ok).toBe(true);
    expect(s.refunds).toEqual([["mock_1", 390]]);
    expect(s.transitions).toEqual(["refunded"]);
  });

  it("перегенерировать оплаченный → generating и задача видео", async () => {
    s.order = { id: "o1", status: "review", amountRub: 390, ...paid };
    await runAdminAction("o1", "regenerate");
    expect(s.transitions).toEqual(["generating"]);
    expect(s.jobs).toEqual(["video"]);
  });

  it("перегенерировать неоплаченный → кадр заново", async () => {
    s.order = { id: "o1", status: "needs_help", amountRub: 390, ...unpaid };
    await runAdminAction("o1", "regenerate");
    expect(s.transitions).toEqual(["preview_generating"]);
    expect(s.jobs).toEqual(["preview"]);
  });

  it("письмо повторно → отправлено и записано в историю", async () => {
    s.order = { id: "o1", status: "delivered", amountRub: 390, email: "a@b.ru", shareToken: "t", ...paid };
    await runAdminAction("o1", "resend");
    expect(s.mails).toEqual(["ready"]);
    expect(s.events).toBe(1);
  });

  it("недоступное действие — 409, ничего не меняется", async () => {
    s.order = { id: "o1", status: "preview_ready", amountRub: 390, ...unpaid };
    expect(await runAdminAction("o1", "refund")).toMatchObject({ ok: false, status: 409 });
    expect(s.refunds).toHaveLength(0);
  });
});
