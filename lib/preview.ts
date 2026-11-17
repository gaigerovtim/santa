/** Перегенерация превью: лимит 1 на заказ и общий лимит превью с IP. */
import { db } from "./db";
import { countPreviewsByIp, LIMIT_MESSAGES, LIMITS, underLimit } from "./limits";
import { getQueue, QUEUE_PREVIEW, type OrderJobData } from "./queue";
import { transition } from "./transition";

export type RegenResult = { ok: true } | { ok: false; status: number; code: string; message: string };

export async function regeneratePreview(token: string, ipHash: string): Promise<RegenResult> {
  const order = await db.order.findUnique({ where: { shareToken: token } });
  if (!order) return { ok: false, status: 404, code: "not_found", message: "Заказ не найден" };
  if (order.status !== "preview_ready") {
    return { ok: false, status: 409, code: "status", message: "Сейчас перегенерировать кадр нельзя" };
  }
  if (!underLimit(order.previewRegens, LIMITS.previewRegensPerOrder)) {
    return { ok: false, status: 429, code: "regen_used", message: LIMIT_MESSAGES.regen_used };
  }
  if (!underLimit(await countPreviewsByIp(ipHash), LIMITS.previewsPerIpPerHour)) {
    return { ok: false, status: 429, code: "ip_hourly", message: LIMIT_MESSAGES.ip_hourly };
  }

  // Счётчик и статус — атомарно: два быстрых нажатия не дадут двух перегенераций.
  const attempt = await db.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: order.id, status: "preview_ready", previewRegens: { lt: LIMITS.previewRegensPerOrder } },
      data: { previewRegens: { increment: 1 } },
    });
    if (claimed.count === 0) return null;
    await transition(order.id, "preview_generating", { actor: "customer", comment: "Перегенерация кадра" }, tx);
    return order.previewRegens + 1;
  });
  if (attempt === null) {
    return { ok: false, status: 429, code: "regen_used", message: LIMIT_MESSAGES.regen_used };
  }

  await getQueue(QUEUE_PREVIEW).add(
    "preview",
    { orderId: order.id } satisfies OrderJobData,
    { jobId: `preview-${order.id}-${attempt}`, priority: 1, attempts: 1 },
  );
  return { ok: true };
}
