import { db } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { buildOrderView } from "@/lib/order-view";
import { SHARE_TOKEN_RE } from "@/lib/tokens";

/** Статус заказа и временные ссылки на доступные файлы. */
export async function GET(_req: Request, ctx: RouteContext<"/api/orders/[token]">) {
  const { token } = await ctx.params;
  if (!SHARE_TOKEN_RE.test(token)) return jsonError(404, "not_found", "Заказ не найден");
  const order = await db.order.findUnique({ where: { shareToken: token } });
  if (!order) return jsonError(404, "not_found", "Заказ не найден");
  return Response.json(
    { ok: true, order: await buildOrderView(order) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
