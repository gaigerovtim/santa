/**
 * Обращения Robokassa к сайту:
 * - ResultURL  — серверное уведомление об оплате (подпись Паролем #2), ответ «OK{InvId}»;
 * - SuccessURL — возврат покупателя после оплаты (подпись Паролем #1);
 * - FailURL    — возврат покупателя после отказа.
 * Robokassa шлёт их методом GET или POST (как выбрано в настройках) — параметры читаем из обоих мест.
 */
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { buildNotification, handlePaymentNotification } from "@/lib/payments";
import { robokassaConfig } from ".";
import { callbackSignature, sameAmount, signaturesEqual } from "./signature";

export async function readParams(req: Request): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  new URL(req.url).searchParams.forEach((v, k) => (out[k] = v));
  if (req.method === "POST") {
    const type = req.headers.get("content-type") ?? "";
    if (type.includes("application/x-www-form-urlencoded") || type.includes("multipart/form-data")) {
      const form = await req.formData();
      form.forEach((v, k) => {
        if (typeof v === "string") out[k] = v;
      });
    }
  }
  return out;
}

function shpOf(params: Record<string, string>) {
  return Object.fromEntries(Object.entries(params).filter(([k]) => k.startsWith("Shp_")));
}

async function findPayment(invIdRaw: string | undefined) {
  if (!invIdRaw || !/^\d{1,10}$/.test(invIdRaw)) return null;
  return db.payment.findUnique({
    where: { invId: Number(invIdRaw) },
    include: { order: { select: { shareToken: true } } },
  });
}

export type ConfirmResult = { ok: true; invId: string } | { ok: false; reason: string };

/**
 * Проверяет подпись и сумму, помечает платёж оплаченным и передаёт в общий обработчик оплаты
 * (переход заказа в paid, задача видео, письмо). Повтор ничего не меняет.
 */
async function confirm(params: Record<string, string>, password: string): Promise<ConfirmResult> {
  const { OutSum: outSum, InvId: invId, SignatureValue: signature } = params;
  if (!outSum || !invId || !signature) return { ok: false, reason: "missing_params" };

  const cfg = robokassaConfig();
  const expected = callbackSignature(outSum, invId, password, cfg.algorithm, shpOf(params));
  if (!signaturesEqual(signature, expected)) return { ok: false, reason: "bad_signature" };

  const payment = await findPayment(invId);
  if (!payment || payment.provider !== "robokassa") return { ok: false, reason: "unknown_invoice" };
  if (!sameAmount(outSum, payment.amountRub)) return { ok: false, reason: "amount_mismatch" };

  if (payment.status === "pending") {
    await db.payment.updateMany({ where: { id: payment.id, status: "pending" }, data: { status: "succeeded" } });
  }
  const result = await handlePaymentNotification(
    buildNotification({ paymentId: payment.id, status: "succeeded", amountRub: payment.amountRub, orderId: payment.orderId }),
  );
  if (!result.handled && result.reason !== "wrong_status") {
    console.error(`[robokassa] счёт ${invId}: оплата подтверждена, но не применена — ${result.reason}`);
  }
  return { ok: true, invId };
}

/** ResultURL: главное подтверждение оплаты. */
export async function handleResult(params: Record<string, string>) {
  const result = await confirm(params, robokassaConfig().password2);
  if (!result.ok) console.warn(`[robokassa] ResultURL отклонён: ${result.reason}`, { InvId: params.InvId });
  return result;
}

/** SuccessURL: возврат покупателя. Если ResultURL недоступен (локально) — запасное подтверждение. */
export async function handleSuccess(params: Record<string, string>): Promise<string> {
  const payment = await findPayment(params.InvId);
  if (!payment) return "/";
  if (env().ROBOKASSA_TRUST_SUCCESS_URL && payment.status === "pending") {
    const result = await confirm(params, robokassaConfig().password1);
    if (!result.ok) console.warn(`[robokassa] SuccessURL не подтвердил оплату: ${result.reason}`);
  }
  return `/order/${payment.order.shareToken}`;
}

/** FailURL: покупатель отказался или оплата не прошла. Статус платежа не трогаем — источник правды ResultURL. */
export async function handleFail(params: Record<string, string>): Promise<string> {
  const payment = await findPayment(params.InvId);
  return payment ? `/order/${payment.order.shareToken}?payment=canceled` : "/";
}
