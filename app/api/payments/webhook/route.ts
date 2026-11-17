import { readJson } from "@/lib/http";
import { handlePaymentNotification } from "@/lib/payments";

/**
 * Уведомления об оплате (от ЮKassa или страницы /mock-pay).
 * Отвечаем 200 на всё, что разобрали, — иначе ЮKassa будет повторять уведомление;
 * на непонятное тело — 400.
 */
export async function POST(req: Request) {
  const result = await handlePaymentNotification(await readJson(req));
  if (!result.handled && result.reason === "invalid_body") {
    return Response.json({ ok: false, error: result.reason }, { status: 400 });
  }
  return Response.json({ ok: true, result });
}
