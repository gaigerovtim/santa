/**
 * Заглушка оплаты. Платежи хранятся в таблице payments; подтверждение — страница /mock-pay/[id],
 * которая отправляет на бэкенд такой же webhook, как ЮKassa. Бэкенд, как и с ЮKassa,
 * не верит телу уведомления и перепроверяет платёж через verifyPayment.
 */
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { PaymentProvider } from "../types";

export type MockPaymentStatus = "pending" | "succeeded" | "canceled";

function asStatus(value: string): MockPaymentStatus {
  return value === "succeeded" || value === "canceled" ? value : "pending";
}

export const mockPaymentProvider: PaymentProvider = {
  name: "mock",

  async createPayment({ orderId, amountRub }) {
    const paymentId = `mock_${randomUUID()}`;
    await db.payment.create({ data: { id: paymentId, orderId, provider: "mock", amountRub } });
    // Куда вернуть покупателя, страница /mock-pay узнаёт по заказу на сервере (не из ссылки —
    // так нельзя подсунуть чужой адрес перехода). returnUrl используется боевыми провайдерами.
    return { paymentId, confirmationUrl: `/mock-pay/${paymentId}` };
  },

  async verifyPayment(paymentId) {
    const payment = await db.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new Error(`Платёж ${paymentId} не найден`);
    return { status: asStatus(payment.status), amountRub: payment.amountRub, orderId: payment.orderId };
  },

  async refund(paymentId, amountRub) {
    const payment = await db.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status !== "succeeded") throw new Error("Вернуть можно только оплаченный платёж");
    if (payment.refundedRub + amountRub > payment.amountRub) throw new Error("Сумма возврата больше суммы платежа");
    await db.payment.update({ where: { id: paymentId }, data: { refundedRub: { increment: amountRub } } });
  },
};

/** Для страницы /mock-pay: отметить платёж оплаченным или отменённым (только из pending). */
export async function settleMockPayment(paymentId: string, outcome: "succeeded" | "canceled") {
  const { count } = await db.payment.updateMany({
    where: { id: paymentId, provider: "mock", status: "pending" },
    data: { status: outcome },
  });
  return count === 1;
}
