/** Доставка готового видео: статус delivered и письмо «Ваше видео готово». */
import type { EventActor } from "@prisma/client";
import { parseArtifacts } from "./artifacts";
import { db } from "./db";
import { notifyReady } from "./notify";
import { transition } from "./transition";

export async function deliverOrder(orderId: string, actor: EventActor = "system", comment = "Видео доставлено") {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (!parseArtifacts(order.artifacts).final) throw new Error("Нельзя доставить заказ без готового видео");
  const delivered = await transition(orderId, "delivered", { actor, comment });
  if (delivered) await notifyReady(delivered);
  return delivered;
}
