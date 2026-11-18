import { env } from "@/lib/env";
import { handleFail, readParams } from "@/lib/providers/robokassa/callbacks";

/** FailURL: покупатель отказался от оплаты → страница заказа с сообщением об отмене. */
async function handle(req: Request) {
  const path = await handleFail(await readParams(req));
  return Response.redirect(new URL(path, env().APP_URL), 303);
}

export const GET = handle;
export const POST = handle;
