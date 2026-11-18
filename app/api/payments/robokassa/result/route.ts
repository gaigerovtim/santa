import { handleResult, readParams } from "@/lib/providers/robokassa/callbacks";

/**
 * ResultURL для Robokassa (указывается в технических настройках магазина):
 *   https://<ваш-домен>/api/payments/robokassa/result
 * Ответ «OK{InvId}» — Robokassa считает уведомление принятым.
 */
async function handle(req: Request) {
  const result = await handleResult(await readParams(req));
  const headers = { "Content-Type": "text/plain; charset=utf-8" };
  return result.ok ? new Response(`OK${result.invId}`, { headers }) : new Response(`bad request: ${result.reason}`, { status: 400, headers });
}

export const GET = handle;
export const POST = handle;
