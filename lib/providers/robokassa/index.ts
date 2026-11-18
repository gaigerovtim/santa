/**
 * Robokassa — реализация PaymentProvider (PAYMENT_PROVIDER=robokassa).
 *
 * Путь платежа:
 * 1. createPayment — запись в payments (номер счёта InvId — автоинкремент), ссылка на форму Robokassa
 *    с подписью Пароль #1; в тестовом режиме — IsTest=1 и тестовые пароли.
 * 2. Robokassa присылает на ResultURL подписанное Паролем #2 уведомление → платёж помечается
 *    оплаченным → общий обработчик (lib/payments.ts) переводит заказ в paid. Ответ — OK{InvId}.
 * 3. Покупатель возвращается через SuccessUrl2/FailUrl2 на страницу заказа.
 * verifyPayment читает статус, выставленный по подписанному уведомлению; в боевом режиме
 * дополнительно сверяется с OpStateExt (в тестовом этот метод Robokassa не работает).
 */
import { randomUUID } from "node:crypto";
import { site } from "@/config/site";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import type { PaymentProvider } from "../types";
import { formatOutSum, hash, paymentSignature } from "./signature";

export const ROBOKASSA_PAY_URL = "https://auth.robokassa.ru/Merchant/Index.aspx";
const OP_STATE_URL = "https://auth.robokassa.ru/Merchant/WebService/Service.asmx/OpStateExt";

export class RobokassaConfigError extends Error {}

export function robokassaConfig() {
  const e = env();
  if (!e.ROBOKASSA_LOGIN || !e.ROBOKASSA_PASSWORD1 || !e.ROBOKASSA_PASSWORD2) {
    throw new RobokassaConfigError(
      "Robokassa не настроена: заполните ROBOKASSA_LOGIN, ROBOKASSA_PASSWORD1 и ROBOKASSA_PASSWORD2 в .env",
    );
  }
  return {
    login: e.ROBOKASSA_LOGIN,
    password1: e.ROBOKASSA_PASSWORD1,
    password2: e.ROBOKASSA_PASSWORD2,
    test: e.ROBOKASSA_TEST,
    algorithm: e.ROBOKASSA_HASH,
    receipt: e.ROBOKASSA_RECEIPT,
    appUrl: e.APP_URL.replace(/\/$/, ""),
  };
}

/** Чек для фискализации (если включена в магазине): одна позиция — услуга, без НДС. */
export function buildReceipt(description: string, amountRub: number): string {
  return JSON.stringify({
    items: [
      {
        name: description.slice(0, 128),
        quantity: 1,
        sum: amountRub,
        payment_method: "full_payment",
        payment_object: "service",
        tax: "none",
      },
    ],
  });
}

/** Ссылка на форму оплаты Robokassa. Отдельная функция — чтобы проверить тестами. */
export function buildPaymentUrl(params: {
  login: string;
  password1: string;
  algorithm: "md5" | "sha256" | "sha384" | "sha512";
  test: boolean;
  invId: number;
  amountRub: number;
  description: string;
  email?: string;
  successUrl: string;
  failUrl: string;
  receipt?: string;
}): string {
  const outSum = formatOutSum(params.amountRub);
  // В подпись идёт URL-кодированный чек — так в примерах документации Robokassa.
  const receiptForSignature = params.receipt ? encodeURIComponent(params.receipt) : undefined;
  const signature = paymentSignature(
    {
      login: params.login,
      outSum,
      invId: params.invId,
      password1: params.password1,
      receipt: receiptForSignature,
      successUrl2: params.successUrl,
      successUrl2Method: "GET",
      failUrl2: params.failUrl,
      failUrl2Method: "GET",
    },
    params.algorithm,
  );

  const query = new URLSearchParams({
    MerchantLogin: params.login,
    OutSum: outSum,
    InvId: String(params.invId),
    Description: params.description.slice(0, 100),
    Culture: "ru",
    Encoding: "utf-8",
    SuccessUrl2: params.successUrl,
    SuccessUrl2Method: "GET",
    FailUrl2: params.failUrl,
    FailUrl2Method: "GET",
    SignatureValue: signature,
  });
  if (params.receipt) query.set("Receipt", params.receipt);
  if (params.email) query.set("Email", params.email);
  if (params.test) query.set("IsTest", "1");
  return `${ROBOKASSA_PAY_URL}?${query.toString()}`;
}

/** Состояние платежа в боевом режиме (OpStateExt). Код 100 — оплачено и зачислено. */
export async function opState(login: string, invId: number, password2: string, algorithm: "md5" | "sha256" | "sha384" | "sha512") {
  const signature = hash(`${login}:${invId}:${password2}`, algorithm);
  const url = `${OP_STATE_URL}?${new URLSearchParams({ MerchantLogin: login, InvoiceID: String(invId), Signature: signature })}`;
  const xml = await (await fetch(url, { signal: AbortSignal.timeout(15_000) })).text();
  const pick = (re: RegExp) => re.exec(xml)?.[1];
  return {
    resultCode: Number(pick(/<Result>\s*<Code>(\d+)<\/Code>/)),
    stateCode: Number(pick(/<State>\s*<Code>(\d+)<\/Code>/)),
    outSum: pick(/<OutSum>([\d.]+)<\/OutSum>/),
  };
}

export const robokassaProvider: PaymentProvider = {
  name: "robokassa",

  async createPayment({ orderId, amountRub, description }) {
    const cfg = robokassaConfig();
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { shareToken: true, email: true } });
    const payment = await db.payment.create({
      data: { id: `robokassa_${randomUUID()}`, orderId, provider: "robokassa", amountRub },
    });
    const back = `${cfg.appUrl}/api/payments/robokassa`;
    const confirmationUrl = buildPaymentUrl({
      login: cfg.login,
      password1: cfg.password1,
      algorithm: cfg.algorithm,
      test: cfg.test,
      invId: payment.invId,
      amountRub,
      description: description || site.name,
      email: order.email,
      successUrl: `${back}/success`,
      failUrl: `${back}/fail`,
      receipt: cfg.receipt ? buildReceipt(description || site.name, amountRub) : undefined,
    });
    return { paymentId: payment.id, confirmationUrl };
  },

  async verifyPayment(paymentId) {
    const payment = await db.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.provider !== "robokassa") throw new Error(`Платёж ${paymentId} не найден`);
    let status: "pending" | "succeeded" | "canceled" =
      payment.status === "succeeded" || payment.status === "canceled" ? payment.status : "pending";

    // В боевом режиме — вторая независимая проверка у самой Robokassa.
    const cfg = robokassaConfig();
    if (status === "succeeded" && !cfg.test) {
      const state = await opState(cfg.login, payment.invId, cfg.password2, cfg.algorithm);
      if (state.resultCode !== 0 || state.stateCode !== 100) status = "pending";
    }
    return { status, amountRub: payment.amountRub, orderId: payment.orderId };
  },

  async refund() {
    // Refund API Robokassa (JWT на Пароль #3, нужен OpKey из OpStateExt) в тестовом режиме недоступен.
    throw new Error(
      "Возврат через Robokassa пока не подключён: оформите его в личном кабинете Robokassa (раздел «Операции»).",
    );
  },
};
