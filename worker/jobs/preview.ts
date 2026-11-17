/**
 * Задача очереди preview: шаги до previewFrom включительно (подготовка фото, frameA,
 * превью с водяным знаком) → статус preview_ready.
 * При перегенерации подготовленное фото не пересчитывается — заново делается только frameA.
 * Если провайдер не справился после повторов — needs_help и уведомление покупателю.
 */
import type { Job } from "bullmq";
import { getEnabledTariff, splitSteps, tariffs, type Tariff, isTariffKey } from "@/config/tariffs";
import { parseArtifacts } from "@/lib/artifacts";
import { db } from "@/lib/db";
import { notifyNeedsHelp } from "@/lib/notify";
import type { OrderJobData } from "@/lib/queue";
import { transition } from "@/lib/transition";
import { loadContext, runSteps } from "../pipeline";

function tariffOf(key: string): Tariff {
  // Заказ мог быть создан до выключения тарифа — берём конфиг даже для выключенного.
  return getEnabledTariff(key) ?? (isTariffKey(key) ? tariffs[key] : tariffs.camera_visit);
}

export async function processPreview(job: Job<OrderJobData>): Promise<void> {
  const { orderId } = job.data;
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return console.warn(`[preview] заказ ${orderId} не найден`);
  if (order.status !== "preview_generating") {
    return console.warn(`[preview] заказ ${orderId} в статусе ${order.status}, задача пропущена`);
  }

  const tariff = tariffOf(order.tariff);
  const steps = splitSteps(tariff).preview;
  const hasRoom = !!parseArtifacts(order.artifacts).room;
  const todo = hasRoom ? steps.filter((s) => s.type !== "prepareRoomPhoto") : steps;

  try {
    const ctx = await loadContext(orderId, tariff);
    await runSteps(ctx, todo);
    await transition(orderId, "preview_ready", { data: { lastError: null }, comment: "Кадр готов" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[preview] заказ ${orderId}:`, message);
    await db.order.update({ where: { id: orderId }, data: { lastError: message.slice(0, 2000) } });
    const updated = await transition(orderId, "needs_help", { comment: "Не удалось сделать кадр" }, db).catch(
      () => null,
    );
    if (updated) await notifyNeedsHelp(updated);
  }
}
