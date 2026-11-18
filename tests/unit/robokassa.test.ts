import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const s = vi.hoisted(() => ({
  env: {
    ROBOKASSA_LOGIN: "demo-shop",
    ROBOKASSA_PASSWORD1: "test-pass-1",
    ROBOKASSA_PASSWORD2: "test-pass-2",
    ROBOKASSA_TEST: true,
    ROBOKASSA_HASH: "md5",
    ROBOKASSA_RECEIPT: false,
    ROBOKASSA_TRUST_SUCCESS_URL: false,
    APP_URL: "http://localhost:3000",
  } as Record<string, unknown>,
  payment: null as null | { id: string; invId: number; provider: string; status: string; amountRub: number; orderId: string; order: { shareToken: string } },
  notifications: [] as unknown[],
  settled: 0,
}));

vi.mock("@/lib/env", () => ({ env: () => s.env }));
vi.mock("@/lib/db", () => ({
  db: {
    payment: {
      findUnique: vi.fn(async () => s.payment),
      updateMany: vi.fn(async () => {
        if (s.payment?.status === "pending") {
          s.payment.status = "succeeded";
          s.settled++;
        }
        return { count: 1 };
      }),
    },
  },
}));
vi.mock("@/lib/payments", async () => ({
  buildNotification: (await vi.importActual<typeof import("@/lib/payments")>("@/lib/payments")).buildNotification,
  handlePaymentNotification: vi.fn(async (n: unknown) => {
    s.notifications.push(n);
    return { handled: true, action: "paid" };
  }),
}));

import { buildPaymentUrl } from "@/lib/providers/robokassa";
import { handleFail, handleResult, handleSuccess } from "@/lib/providers/robokassa/callbacks";
import {
  callbackSignature,
  formatOutSum,
  paymentSignatureBase,
  sameAmount,
  shpPart,
  signaturesEqual,
} from "@/lib/providers/robokassa/signature";

const md5 = (v: string) => createHash("md5").update(v).digest("hex");

describe("подписи Robokassa — формулы из документации", () => {
  it("платёж: MerchantLogin:OutSum:InvId:Пароль#1", () => {
    expect(paymentSignatureBase({ login: "Test1999", outSum: "100", invId: 678678, password1: "p1" })).toBe(
      "Test1999:100:678678:p1",
    );
  });

  it("чек и переадресация — в порядке Receipt, SuccessUrl2, SuccessUrl2Method, FailUrl2, FailUrl2Method", () => {
    expect(
      paymentSignatureBase({
        login: "L",
        outSum: "390.00",
        invId: 5,
        password1: "p1",
        receipt: "R",
        successUrl2: "https://s",
        successUrl2Method: "GET",
        failUrl2: "https://f",
        failUrl2Method: "POST",
      }),
    ).toBe("L:390.00:5:R:https://s:GET:https://f:POST:p1");
  });

  it("Shp_-параметры — после пароля, по алфавиту", () => {
    expect(shpPart({ Shp_oplata: "1", Shp_login: "Vasya", other: "x" })).toEqual(["Shp_login=Vasya", "Shp_oplata=1"]);
    expect(paymentSignatureBase({ login: "L", outSum: "1", invId: 2, password1: "p", shp: { Shp_b: "2", Shp_a: "1" } })).toBe(
      "L:1:2:p:Shp_a=1:Shp_b=2",
    );
  });

  it("ResultURL: OutSum:InvId:Пароль#2[:Shp_*] — пример из документации", () => {
    const sig = callbackSignature("100.000000", "450009", "P2", "md5", { Shp_oplata: "1", Shp_login: "Vasya" });
    expect(sig).toBe(md5("100.000000:450009:P2:Shp_login=Vasya:Shp_oplata=1"));
  });

  it("другие алгоритмы — как в настройках магазина", () => {
    expect(callbackSignature("1", "2", "p", "sha256")).toBe(createHash("sha256").update("1:2:p").digest("hex"));
  });

  it("подпись сравнивается без учёта регистра", () => {
    expect(signaturesEqual("ABCDEF", "abcdef")).toBe(true);
    expect(signaturesEqual("abcdef", "abcdee")).toBe(false);
  });

  it("сумма: 390.00 в запросе; 390.000000 и 390.00 в уведомлении равны 390 ₽", () => {
    expect(formatOutSum(390)).toBe("390.00");
    expect(sameAmount("390.000000", 390)).toBe(true);
    expect(sameAmount("390.00", 390)).toBe(true);
    expect(sameAmount("1.00", 390)).toBe(false);
    expect(sameAmount("abc", 390)).toBe(false);
  });
});

describe("ссылка на оплату", () => {
  const base = {
    login: "demo-shop",
    password1: "test-pass-1",
    algorithm: "md5" as const,
    invId: 42,
    amountRub: 390,
    description: "Визит Деда Мороза",
    email: "a@b.ru",
    successUrl: "http://localhost:3000/api/payments/robokassa/success",
    failUrl: "http://localhost:3000/api/payments/robokassa/fail",
  };

  it("тестовый режим: IsTest=1, сумма, номер счёта, верная подпись", () => {
    const url = new URL(buildPaymentUrl({ ...base, test: true }));
    expect(url.origin + url.pathname).toBe("https://auth.robokassa.ru/Merchant/Index.aspx");
    const q = url.searchParams;
    expect(q.get("IsTest")).toBe("1");
    expect(q.get("OutSum")).toBe("390.00");
    expect(q.get("InvId")).toBe("42");
    expect(q.get("Email")).toBe("a@b.ru");
    expect(q.get("SignatureValue")).toBe(
      md5(`demo-shop:390.00:42:${base.successUrl}:GET:${base.failUrl}:GET:test-pass-1`),
    );
  });

  it("боевой режим — без IsTest", () => {
    expect(new URL(buildPaymentUrl({ ...base, test: false })).searchParams.has("IsTest")).toBe(false);
  });

  it("с чеком: Receipt в запросе, URL-кодированный чек — в подписи", () => {
    const receipt = '{"items":[{"name":"Визит","sum":390}]}';
    const q = new URL(buildPaymentUrl({ ...base, test: true, receipt })).searchParams;
    expect(q.get("Receipt")).toBe(receipt);
    expect(q.get("SignatureValue")).toBe(
      md5(`demo-shop:390.00:42:${encodeURIComponent(receipt)}:${base.successUrl}:GET:${base.failUrl}:GET:test-pass-1`),
    );
  });
});

describe("обращения Robokassa", () => {
  const signed = (outSum: string, invId: string, password: string) => ({
    OutSum: outSum,
    InvId: invId,
    SignatureValue: md5(`${outSum}:${invId}:${password}`).toUpperCase(),
  });

  beforeEach(() => {
    s.payment = {
      id: "robokassa_x",
      invId: 42,
      provider: "robokassa",
      status: "pending",
      amountRub: 390,
      orderId: "o1",
      order: { shareToken: "TOKEN" },
    };
    s.notifications = [];
    s.settled = 0;
    s.env.ROBOKASSA_TRUST_SUCCESS_URL = false;
  });

  it("ResultURL с верной подписью → OK{InvId}, платёж оплачен, заказ уходит в общий обработчик", async () => {
    const r = await handleResult(signed("390.000000", "42", "test-pass-2"));
    expect(r).toEqual({ ok: true, invId: "42" });
    expect(s.settled).toBe(1);
    expect(s.notifications).toHaveLength(1);
    expect(s.notifications[0]).toMatchObject({ event: "payment.succeeded", object: { id: "robokassa_x" } });
  });

  it("подпись Паролем #1 вместо #2 (или подделка) — отказ, ничего не меняется", async () => {
    expect(await handleResult(signed("390.000000", "42", "test-pass-1"))).toEqual({ ok: false, reason: "bad_signature" });
    expect(await handleResult({ OutSum: "390.00", InvId: "42", SignatureValue: "0".repeat(32) })).toMatchObject({ ok: false });
    expect(s.settled).toBe(0);
    expect(s.notifications).toHaveLength(0);
  });

  it("сумма не совпадает с платежом — отказ", async () => {
    expect(await handleResult(signed("1.00", "42", "test-pass-2"))).toEqual({ ok: false, reason: "amount_mismatch" });
  });

  it("повтор уведомления — снова OK, платёж не переоплачивается", async () => {
    await handleResult(signed("390.000000", "42", "test-pass-2"));
    const again = await handleResult(signed("390.000000", "42", "test-pass-2"));
    expect(again.ok).toBe(true);
    expect(s.settled).toBe(1);
  });

  it("неизвестный счёт и мусор в InvId — отказ", async () => {
    s.payment = null;
    expect(await handleResult(signed("390.00", "42", "test-pass-2"))).toEqual({ ok: false, reason: "unknown_invoice" });
    expect(await handleResult(signed("390.00", "42; DROP", "test-pass-2"))).toMatchObject({ ok: false });
  });

  it("SuccessURL: по умолчанию только возврат на заказ, без подтверждения оплаты", async () => {
    expect(await handleSuccess(signed("390.00", "42", "test-pass-1"))).toBe("/order/TOKEN");
    expect(s.settled).toBe(0);
  });

  it("SuccessURL с ROBOKASSA_TRUST_SUCCESS_URL: подпись Паролем #1 подтверждает оплату", async () => {
    s.env.ROBOKASSA_TRUST_SUCCESS_URL = true;
    expect(await handleSuccess(signed("390.00", "42", "test-pass-1"))).toBe("/order/TOKEN");
    expect(s.settled).toBe(1);
    // а без верной подписи — нет
    s.payment!.status = "pending";
    s.settled = 0;
    await handleSuccess(signed("390.00", "42", "wrong"));
    expect(s.settled).toBe(0);
  });

  it("FailURL — на заказ с пометкой об отмене", async () => {
    expect(await handleFail({ InvId: "42" })).toBe("/order/TOKEN?payment=canceled");
  });
});
