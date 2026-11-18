/**
 * Действия администратора: одобрить, перегенерировать, вернуть деньги, отправить письмо повторно.
 * availableActions() решает, что доступно в каком статусе, — по ней же рисуются кнопки.
 */
import type { Order } from "@prisma/client";
import { parseArtifacts } from "./artifacts";
import { db } from "./db";
import { deliverOrder } from "./delivery";
import { notify, type EmailKind } from "./notify";
import type { OrderStatusName } from "./order-status";
import { getPaymentProvider } from "./providers";
import { getQueue, QUEUE_PREVIEW, type OrderJobData } from "./queue";
import { transition } from "./transition";
import { requeueVideo } from "./video-queue";

export type AdminAction = "approve" | "regenerate" | "refund" | "resend";

type OrderLike = Pick<Order, "status" | "paidAt" | "artifacts" | "paymentId">;

/** Какое письмо уместно отправить повторно в этом статусе. */
export function resendKind(status: OrderStatusName): EmailKind | null {
  if (status === "delivered") return "ready";
  if (status === "paid" || status === "generating" || status === "review") return "paid";
  if (status === "needs_help") return "delayed";
  return null;
}

export function availableActions(order: OrderLike): AdminAction[] {
  const status = order.status as OrderStatusName;
  const paid = !!order.paidAt;
  const hasFinal = !!parseArtifacts(order.artifacts).final;
  const out: AdminAction[] = [];
  if (status === "review" || (status === "needs_help" && paid && hasFinal)) out.push("approve");
  if (
    (paid && ["review", "delivered", "needs_help"].includes(status)) ||
    (!paid && ["needs_help", "preview_ready"].includes(status))
  ) {
    out.push("regenerate");
  }
  if (paid && order.paymentId && ["paid", "generating", "review", "delivered", "needs_help"].includes(status)) {
    out.push("refund");
  }
  if (resendKind(status)) out.push("resend");
  return out;
}

export type ActionResult = { ok: true; message: string } | { ok: false; status: number; message: string };

async function load(orderId: string) {
  return db.order.findUnique({ where: { id: orderId } });
}

function denied(action: AdminAction, status: string): ActionResult {
  return { ok: false, status: 409, message: `Действие «${action}» недоступно в статусе ${status}` };
}

export async function runAdminAction(orderId: string, action: AdminAction): Promise<ActionResult> {
  const order = await load(orderId);
  if (!order) return { ok: false, status: 404, message: "Заказ не найден" };
  if (!availableActions(order).includes(action)) return denied(action, order.status);

  switch (action) {
    case "approve": {
      await deliverOrder(order.id, "admin", "Одобрено администратором");
      return { ok: true, message: "Одобрено: видео доставлено, письмо отправлено" };
    }

    case "regenerate": {
      if (order.paidAt) {
        await transition(order.id, "generating", { actor: "admin", comment: "Перегенерация видео" });
        await requeueVideo(order.id, "admin");
        return { ok: true, message: "Видео поставлено на перегенерацию" };
      }
      await transition(order.id, "preview_generating", { actor: "admin", comment: "Перегенерация кадра администратором" });
      await getQueue(QUEUE_PREVIEW).add(
        "preview",
        { orderId: order.id } satisfies OrderJobData,
        { jobId: `preview-${order.id}-admin-${Date.now()}`, priority: 1, attempts: 1 },
      );
      return { ok: true, message: "Кадр поставлен на перегенерацию" };
    }

    case "refund": {
      const provider = await getPaymentProvider();
      await provider.refund(order.paymentId!, order.amountRub);
      await transition(order.id, "refunded", {
        actor: "admin",
        comment: `Возврат ${order.amountRub} ₽ (${provider.name})`,
      });
      return { ok: true, message: `Возвращено ${order.amountRub} ₽` };
    }

    case "resend": {
      const kind = resendKind(order.status as OrderStatusName)!;
      const sent = await notify(kind, order);
      if (!sent) return { ok: false, status: 502, message: "Письмо не отправилось — проверьте SMTP" };
      await db.orderEvent.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: order.status,
          actor: "admin",
          comment: `Письмо «${kind}» отправлено повторно`,
        },
      });
      return { ok: true, message: "Письмо отправлено повторно" };
    }
  }
}

export const ACTION_LABELS: Record<AdminAction, string> = {
  approve: "Одобрить",
  regenerate: "Перегенерировать",
  refund: "Вернуть деньги",
  resend: "Отправить письмо повторно",
};
