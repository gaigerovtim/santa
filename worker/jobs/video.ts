/**
 * Задача очереди video (после оплаты): шаги после previewFrom — frameB, ролик, постобработка.
 * Дальше: при ручном одобрении — статус review (ждёт администратора), иначе — delivered и письмо.
 * Сбой после повторов провайдера — needs_help и письмо «Немного задерживаемся».
 */
import type { Job } from "bullmq";
import { isTariffKey, splitSteps, tariffs, type Tariff } from "@/config/tariffs";
import { db } from "@/lib/db";
import { deliverOrder } from "@/lib/delivery";
import { notifyNeedsHelp } from "@/lib/notify";
import type { OrderJobData } from "@/lib/queue";
import { getManualApproval } from "@/lib/settings";
import { transition } from "@/lib/transition";
import { loadContext, runSteps } from "../pipeline";

function tariffOf(key: string): Tariff {
  return isTariffKey(key) ? tariffs[key] : tariffs.camera_visit;
}

export async function processVideo(job: Job<OrderJobData>): Promise<void> {
  const { orderId } = job.data;
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) return console.warn(`[video] заказ ${orderId} не найден`);

  // paid — обычный путь после оплаты; generating — повтор (перезапуск воркера или перегенерация из админки).
  if (order.status === "paid") {
    await transition(orderId, "generating", { comment: "Генерация видео" });
  } else if (order.status !== "generating") {
    return console.warn(`[video] заказ ${orderId} в статусе ${order.status}, задача пропущена`);
  }

  try {
    const tariff = tariffOf(order.tariff);
    const ctx = await loadContext(orderId, tariff);
    await runSteps(ctx, splitSteps(tariff).video);
    await db.order.update({ where: { id: orderId }, data: { lastError: null } });

    if (await getManualApproval()) {
      await transition(orderId, "review", { comment: "Ждёт одобрения администратора" });
    } else {
      await deliverOrder(orderId);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[video] заказ ${orderId}:`, message);
    await db.order.update({ where: { id: orderId }, data: { lastError: message.slice(0, 2000) } });
    const updated = await transition(orderId, "needs_help", { comment: "Не удалось сделать видео" }).catch(() => null);
    if (updated) await notifyNeedsHelp(updated);
  }
}
