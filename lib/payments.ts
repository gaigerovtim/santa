/**
 * Оплата: создание платежа и обработка уведомлений (webhook) в формате ЮKassa.
 * Сумма — только из заказа (а в заказ она попала из конфига тарифа).
 * Повторное уведомление ничего не меняет: смена статуса условная, в одной транзакции,
 * задача видео ставится с фиксированным jobId.
 */
import { z } from "zod";
import { site } from "@/config/site";
import { tariffs, isTariffKey } from "@/config/tariffs";
import { db } from "./db";
import { env } from "./env";
import { notifyPaid } from "./notify";
import { getPaymentProvider } from "./providers";
import { getQueue, QUEUE_VIDEO, type OrderJobData } from "./queue";
import { transition } from "./transition";

export type PayResult =
  | { ok: true; confirmationUrl: string }
  | { ok: false; status: number; code: string; message: string };

/** Создаёт платёж для заказа в статусе preview_ready. */
export async function startPayment(token: string, origin: string): Promise<PayResult> {
  const order = await db.order.findUnique({ where: { shareToken: token } });
  if (!order) return { ok: false, status: 404, code: "not_found", message: "Заказ не найден" };
  if (order.status !== "preview_ready") {
    return { ok: false, status: 409, code: "status", message: "Этот заказ сейчас нельзя оплатить" };
  }

  const provider = await getPaymentProvider();
  const title = isTariffKey(order.tariff) ? tariffs[order.tariff].title : site.name;
  const base = env().NODE_ENV === "production" ? env().APP_URL : origin;
  const { paymentId, confirmationUrl } = await provider.createPayment({
    orderId: order.id,
    amountRub: order.amountRub,
    description: `${title} — заказ ${order.id.slice(0, 8)}`,
    returnUrl: `${base}/order/${token}`,
  });
  await db.order.update({
    where: { id: order.id },
    data: { paymentId, paymentProvider: provider.name },
  });
  return { ok: true, confirmationUrl };
}

/** Уведомление ЮKassa: https://yookassa.ru/developers/using-api/webhooks */
export const notificationSchema = z.object({
  type: z.literal("notification"),
  event: z.string(),
  object: z
    .object({
      id: z.string().min(1).max(100),
      status: z.string().optional(),
      amount: z.object({ value: z.string(), currency: z.string() }).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
    .passthrough(),
});

export type NotificationResult =
  | { handled: true; action: "paid" | "already_paid" | "canceled" | "ignored"; orderId?: string }
  | { handled: false; reason: string };

export async function handlePaymentNotification(body: unknown): Promise<NotificationResult> {
  const parsed = notificationSchema.safeParse(body);
  if (!parsed.success) return { handled: false, reason: "invalid_body" };
  const { event, object } = parsed.data;

  if (event !== "payment.succeeded" && event !== "payment.canceled") {
    return { handled: true, action: "ignored" };
  }

  // Не верим телу уведомления — спрашиваем провайдера сами.
  const provider = await getPaymentProvider();
  let verified;
  try {
    verified = await provider.verifyPayment(object.id);
  } catch {
    return { handled: false, reason: "unknown_payment" };
  }

  const order = await db.order.findUnique({ where: { id: verified.orderId } });
  if (!order) return { handled: false, reason: "unknown_order" };

  if (verified.status === "canceled") {
    console.log(`[payment] заказ ${order.id}: платёж ${object.id} отменён`);
    return { handled: true, action: "canceled", orderId: order.id };
  }
  if (verified.status !== "succeeded") return { handled: false, reason: "not_succeeded" };

  if (verified.amountRub !== order.amountRub) {
    console.error(`[payment] заказ ${order.id}: сумма ${verified.amountRub} ≠ ${order.amountRub}`);
    await db.order.update({
      where: { id: order.id },
      data: { lastError: `Сумма платежа ${verified.amountRub} ₽ не совпадает с заказом ${order.amountRub} ₽` },
    });
    return { handled: false, reason: "amount_mismatch" };
  }

  // Смена статуса и привязка платежа — в одной транзакции, условно (повтор не проведёт второй раз).
  let moved;
  try {
    moved = await transition(order.id, "paid", {
      allowSame: true,
      comment: `Оплата ${verified.amountRub} ₽ (${provider.name})`,
      data: { paymentId: object.id, paymentProvider: provider.name },
    });
  } catch (err) {
    // Оплата пришла, а заказ уже не ждёт её (например, истёк) — нужен человек.
    const message = `Оплата пришла для заказа в статусе ${order.status}: ${(err as Error).message}`;
    console.error(`[payment] заказ ${order.id}: ${message}`);
    await db.order.update({ where: { id: order.id }, data: { lastError: message } });
    return { handled: false, reason: "wrong_status" };
  }

  if (!moved) return { handled: true, action: "already_paid", orderId: order.id };

  await getQueue(QUEUE_VIDEO).add(
    "video",
    { orderId: order.id } satisfies OrderJobData,
    { jobId: `video-${order.id}`, attempts: 1 },
  );
  console.log(`[payment] заказ ${order.id}: оплачен, задача видео поставлена`);
  // Письмо — только при первом переходе в paid; ошибка почты не ломает обработку оплаты.
  await notifyPaid(moved);
  return { handled: true, action: "paid", orderId: order.id };
}

/** Тело уведомления в формате ЮKassa — его же отправляет страница /mock-pay. */
export function buildNotification(params: {
  paymentId: string;
  status: "succeeded" | "canceled";
  amountRub: number;
  orderId: string;
}) {
  return {
    type: "notification" as const,
    event: `payment.${params.status}`,
    object: {
      id: params.paymentId,
      status: params.status,
      paid: params.status === "succeeded",
      amount: { value: params.amountRub.toFixed(2), currency: "RUB" },
      metadata: { orderId: params.orderId },
      created_at: new Date().toISOString(),
      test: true,
    },
  };
}
