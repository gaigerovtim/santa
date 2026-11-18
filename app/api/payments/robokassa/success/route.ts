import { env } from "@/lib/env";
import { handleSuccess, readParams } from "@/lib/providers/robokassa/callbacks";

/** SuccessURL: Robokassa возвращает сюда покупателя после оплаты → страница заказа. */
async function handle(req: Request) {
  const path = await handleSuccess(await readParams(req));
  return Response.redirect(new URL(path, env().APP_URL), 303);
}

export const GET = handle;
export const POST = handle;
