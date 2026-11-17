import { z } from "zod";
import { db } from "@/lib/db";
import { env, mocksAllowed } from "@/lib/env";
import { jsonError, readJson } from "@/lib/http";
import { buildNotification } from "@/lib/payments";
import { settleMockPayment } from "@/lib/providers/mock/payment";

const bodySchema = z.object({ outcome: z.enum(["succeeded", "canceled"]) });

/**
 * Кнопки страницы «Тестовая оплата»: меняют статус mock-платежа и отправляют на бэкенд
 * webhook в формате ЮKassa — тот же путь, что пройдёт настоящее уведомление.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/mock-pay/[id]">) {
  if (!mocksAllowed() || env().PAYMENT_PROVIDER !== "mock") return jsonError(404, "not_found", "Не найдено");
  const { id } = await ctx.params;
  const parsed = bodySchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, "invalid", "Неверный запрос");

  const payment = await db.payment.findUnique({ where: { id }, include: { order: true } });
  if (!payment || payment.provider !== "mock") return jsonError(404, "not_found", "Платёж не найден");

  const changed = await settleMockPayment(id, parsed.data.outcome);
  const status = changed ? parsed.data.outcome : (payment.status as "succeeded" | "canceled");

  const origin = new URL(req.url).origin;
  const webhook = await fetch(`${origin}/api/payments/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      buildNotification({ paymentId: id, status, amountRub: payment.amountRub, orderId: payment.orderId }),
    ),
  });
  if (!webhook.ok) return jsonError(502, "webhook", "Не удалось отправить уведомление об оплате");

  const query = status === "canceled" ? "?payment=canceled" : "";
  return Response.json({ ok: true, redirect: `/order/${payment.order.shareToken}${query}` });
}
