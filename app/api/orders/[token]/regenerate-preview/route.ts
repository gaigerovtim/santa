import { jsonError } from "@/lib/http";
import { clientIp, hashIp } from "@/lib/limits";
import { regeneratePreview } from "@/lib/preview";
import { SHARE_TOKEN_RE } from "@/lib/tokens";

/** Перегенерация кадра-превью: один раз бесплатно, и в общем лимите превью с IP. */
export async function POST(req: Request, ctx: RouteContext<"/api/orders/[token]/regenerate-preview">) {
  const { token } = await ctx.params;
  if (!SHARE_TOKEN_RE.test(token)) return jsonError(404, "not_found", "Заказ не найден");
  const result = await regeneratePreview(token, hashIp(clientIp(req.headers)));
  if (!result.ok) return jsonError(result.status, result.code, result.message);
  return Response.json({ ok: true });
}
