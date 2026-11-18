import { z } from "zod";
import { requireAdminApi } from "@/lib/admin-auth";
import { jsonError, readJson } from "@/lib/http";
import { getManualApproval, setManualApproval } from "@/lib/settings";

export async function GET(req: Request) {
  const denied = await requireAdminApi(req);
  if (denied) return denied;
  return Response.json({ ok: true, manualApproval: await getManualApproval() });
}

const schema = z.object({ manualApproval: z.boolean() });

/** Переключатель «Ручное одобрение». */
export async function POST(req: Request) {
  const denied = await requireAdminApi(req);
  if (denied) return denied;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError(400, "invalid", "Неверный запрос");
  await setManualApproval(parsed.data.manualApproval);
  return Response.json({ ok: true, manualApproval: parsed.data.manualApproval });
}
