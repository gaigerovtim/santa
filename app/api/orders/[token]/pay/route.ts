import { jsonError } from "@/lib/http";
import { startPayment } from "@/lib/payments";
import { SHARE_TOKEN_RE } from "@/lib/tokens";

/** Создаёт платёж через провайдера оплаты и возвращает адрес для перехода. */
export async function POST(req: Request, ctx: RouteContext<"/api/orders/[token]/pay">) {
  const { token } = await ctx.params;
  if (!SHARE_TOKEN_RE.test(token)) return jsonError(404, "not_found", "Заказ не найден");
  try {
    const result = await startPayment(token, new URL(req.url).origin);
    if (!result.ok) return jsonError(result.status, result.code, result.message);
    return Response.json({ ok: true, confirmationUrl: result.confirmationUrl });
  } catch (err) {
    console.error("Ошибка создания платежа:", err);
    return jsonError(502, "payment_provider", "Не получилось перейти к оплате. Попробуйте ещё раз");
  }
}
