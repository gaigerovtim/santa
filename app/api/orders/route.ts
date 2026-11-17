import { env } from "@/lib/env";
import { jsonError, readJson } from "@/lib/http";
import { clientIp, hashIp } from "@/lib/limits";
import { createOrder } from "@/lib/orders";
import { createOrderSchema, fieldErrors } from "@/lib/schemas";

/** Создаёт заказ (ключ фото, email, согласия) и ставит задачу в очередь preview. */
export async function POST(req: Request) {
  if (!env().ORDERS_ENABLED) return jsonError(503, "orders_disabled", "Приём заказов временно закрыт");

  const parsed = createOrderSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return jsonError(400, "validation", "Проверьте данные формы", { fields: fieldErrors(parsed.error) });
  }

  try {
    const result = await createOrder(parsed.data, hashIp(clientIp(req.headers)));
    if (!result.ok) return jsonError(result.status, result.code, result.message);
    return Response.json(
      { ok: true, token: result.token, url: `/order/${result.token}` },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof Error && err.message === "upload_already_used") {
      return jsonError(409, "upload", "Это фото уже использовано в заказе. Загрузите его ещё раз");
    }
    console.error("Ошибка создания заказа:", err);
    return jsonError(500, "server", "Не получилось создать заказ. Попробуйте ещё раз");
  }
}
