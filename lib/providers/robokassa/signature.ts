/**
 * Подписи Robokassa (https://docs.robokassa.ru/ru/pay-interface, /ru/notifications-and-redirects).
 * Чистые функции без зависимостей — проверяются тестами на примерах из документации.
 *
 * Платёж:      MerchantLogin:OutSum:InvId[:Receipt][:SuccessUrl2:SuccessUrl2Method:FailUrl2:FailUrl2Method]:Пароль#1[:Shp_*]
 * ResultURL:   OutSum:InvId:Пароль#2[:Shp_*]
 * SuccessURL:  OutSum:InvId:Пароль#1[:Shp_*]
 * Shp_-параметры — по алфавиту, в виде `Shp_key=value`. IsTest, Email, Culture в подпись не входят.
 */
import { createHash, timingSafeEqual } from "node:crypto";

export type HashAlgorithm = "md5" | "sha256" | "sha384" | "sha512";

export function hash(value: string, algorithm: HashAlgorithm): string {
  return createHash(algorithm).update(value, "utf8").digest("hex");
}

/** Shp_-параметры по алфавиту: ["Shp_a=1", "Shp_b=2"]. */
export function shpPart(shp: Record<string, string> = {}): string[] {
  return Object.keys(shp)
    .filter((k) => k.startsWith("Shp_"))
    .sort()
    .map((k) => `${k}=${shp[k]}`);
}

export interface PaymentSignatureInput {
  login: string;
  outSum: string;
  invId: number | string;
  password1: string;
  receipt?: string;
  successUrl2?: string;
  successUrl2Method?: "GET" | "POST";
  failUrl2?: string;
  failUrl2Method?: "GET" | "POST";
  shp?: Record<string, string>;
}

export function paymentSignatureBase(p: PaymentSignatureInput): string {
  const parts = [p.login, p.outSum, String(p.invId)];
  // Модификаторы — только присутствующие и строго в порядке документации.
  if (p.receipt) parts.push(p.receipt);
  if (p.successUrl2) parts.push(p.successUrl2, p.successUrl2Method ?? "GET");
  if (p.failUrl2) parts.push(p.failUrl2, p.failUrl2Method ?? "GET");
  parts.push(p.password1, ...shpPart(p.shp));
  return parts.join(":");
}

export function paymentSignature(p: PaymentSignatureInput, algorithm: HashAlgorithm): string {
  return hash(paymentSignatureBase(p), algorithm);
}

/** Подпись уведомления (ResultURL, Пароль #2) или переадресации (SuccessURL, Пароль #1). */
export function callbackSignature(
  outSum: string,
  invId: string,
  password: string,
  algorithm: HashAlgorithm,
  shp: Record<string, string> = {},
): string {
  return hash([outSum, invId, password, ...shpPart(shp)].join(":"), algorithm);
}

/** Сравнение подписей без учёта регистра и за постоянное время. */
export function signaturesEqual(a: string, b: string): boolean {
  const x = Buffer.from(a.toLowerCase());
  const y = Buffer.from(b.toLowerCase());
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Сумма в формате Robokassa: число через точку, «390.00». */
export function formatOutSum(rub: number): string {
  return rub.toFixed(2);
}

/** Robokassa присылает «390.000000» или «390.00» — сравниваем в копейках. */
export function sameAmount(outSum: string, rub: number): boolean {
  const n = Number(outSum);
  return Number.isFinite(n) && Math.round(n * 100) === Math.round(rub * 100);
}
