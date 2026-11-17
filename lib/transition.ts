/**
 * Единственный способ сменить статус заказа.
 * Проверяет допустимость перехода и пишет запись в order_events — в одной транзакции.
 * Смена статуса условная (WHERE status = текущий), поэтому два параллельных вызова
 * (например, повторный webhook об оплате) не проведут переход дважды.
 */
import type { EventActor, Order, Prisma, PrismaClient } from "@prisma/client";
import { db } from "./db";
import { canTransition, TransitionError, type OrderStatusName } from "./order-status";

type Client = PrismaClient | Prisma.TransactionClient;

export interface TransitionOptions {
  actor?: EventActor;
  comment?: string;
  /** Дополнительные поля заказа, которые меняются вместе со статусом. */
  data?: Prisma.OrderUpdateManyMutationInput;
  /** Если заказ уже в статусе `to` — не ошибка, вернуть null (идемпотентность). */
  allowSame?: boolean;
}

/** Поля-отметки времени, которые ставятся автоматически при переходе. */
function timestampsFor(to: OrderStatusName): Prisma.OrderUpdateManyMutationInput {
  const now = new Date();
  if (to === "paid") return { paidAt: now };
  if (to === "delivered") return { deliveredAt: now };
  return {};
}

async function run(
  tx: Prisma.TransactionClient,
  orderId: string,
  to: OrderStatusName,
  opts: TransitionOptions,
): Promise<Order | null> {
  const current = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!current) throw new TransitionError(null, to);
  const from = current.status as OrderStatusName;

  if (from === to && opts.allowSame) return null;
  if (!canTransition(from, to)) throw new TransitionError(from, to);

  const { count } = await tx.order.updateMany({
    where: { id: orderId, status: from },
    data: { ...timestampsFor(to), ...opts.data, status: to },
  });
  // Статус успели поменять параллельно — переход не наш.
  if (count === 0) {
    if (opts.allowSame) {
      const now = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
      if (now?.status === to) return null;
    }
    throw new TransitionError(from, to);
  }

  await tx.orderEvent.create({
    data: {
      orderId,
      fromStatus: from,
      toStatus: to,
      actor: opts.actor ?? "system",
      comment: opts.comment,
    },
  });

  return tx.order.findUniqueOrThrow({ where: { id: orderId } });
}

/**
 * Переводит заказ в статус `to`. Возвращает обновлённый заказ,
 * или null, если заказ уже был в `to` и передан allowSame.
 * Если передан клиент транзакции — работает внутри неё, иначе открывает свою.
 */
export async function transition(
  orderId: string,
  to: OrderStatusName,
  opts: TransitionOptions = {},
  client: Client = db,
): Promise<Order | null> {
  if ("$transaction" in client) {
    return client.$transaction((tx) => run(tx, orderId, to, opts));
  }
  return run(client, orderId, to, opts);
}
