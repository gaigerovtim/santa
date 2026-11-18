import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { runAdminAction } from "@/lib/admin-actions";
import { jsonError } from "@/lib/http";

const actionSchema = z.enum(["approve", "regenerate", "refund", "resend"]);

/** POST /api/admin/orders/<id>/<approve|regenerate|refund|resend> */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/orders/[id]/[action]">) {
  const denied = await requireAdminApi(req);
  if (denied) return denied;
  const { id, action } = await ctx.params;
  const parsedAction = actionSchema.safeParse(action);
  if (!parsedAction.success || !z.uuid().safeParse(id).success) return jsonError(404, "not_found", "Не найдено");

  try {
    const result = await runAdminAction(id, parsedAction.data);
    if (!result.ok) return jsonError(result.status, "action", result.message);
    return Response.json({ ok: true, message: result.message });
  } catch (err) {
    console.error(`[admin] ${action} ${id}:`, err);
    return jsonError(500, "server", `Не получилось: ${(err as Error).message}`);
  }
}
