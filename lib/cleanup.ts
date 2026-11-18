/**
 * Ежедневная очистка по срокам хранения (ТЗ):
 * - исходные фото — через 72 часа после доставки;
 * - неоплаченные заказы — через 7 дней: статус expired, файлы удаляются;
 * - видео — через 30 дней после доставки;
 * - загрузки без заказа — через 24 часа (docs/decisions.md, п. 4).
 * Решение «что удалить» — чистая функция planCleanup(), её проверяют тесты.
 */
import { Prisma } from "@prisma/client";
import { parseArtifacts, type ArtifactKey, type Artifacts } from "./artifacts";
import { db } from "./db";
import { deleteObject } from "./s3";
import { transition } from "./transition";

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

export const RETENTION = {
  sourcePhotoAfterDeliveryMs: 72 * HOUR,
  unpaidOrderMs: 7 * DAY,
  videoAfterDeliveryMs: 30 * DAY,
  orphanUploadMs: 24 * HOUR,
} as const;

/** Исходные файлы покупателя: само фото и его подготовленная копия. */
const SOURCE_KEYS: ArtifactKey[] = ["room"];
/** Всё, что получилось из фото: кадры, превью, ролики. */
const RESULT_KEYS: ArtifactKey[] = ["frameA", "frameB", "preview", "clip", "final"];

const UNPAID_STATUSES = ["created", "preview_generating", "preview_ready", "needs_help"] as const;

export interface CleanupOrder {
  id: string;
  status: string;
  createdAt: Date;
  paidAt: Date | null;
  deliveredAt: Date | null;
  roomPhotoKey: string | null;
  artifacts: Artifacts;
}

export interface CleanupPlan {
  expire: boolean;
  deleteKeys: string[];
  /** Какие поля заказа очистить вслед за удалёнными файлами. */
  dropArtifacts: ArtifactKey[];
  dropRoomPhoto: boolean;
}

export function planCleanup(order: CleanupOrder, now = Date.now()): CleanupPlan {
  const plan: CleanupPlan = { expire: false, deleteKeys: [], dropArtifacts: [], dropRoomPhoto: false };
  const drop = (keys: ArtifactKey[]) => {
    for (const k of keys) {
      const key = order.artifacts[k];
      if (key) {
        plan.deleteKeys.push(key);
        plan.dropArtifacts.push(k);
      }
    }
  };
  const dropSource = () => {
    if (order.roomPhotoKey) {
      plan.deleteKeys.push(order.roomPhotoKey);
      plan.dropRoomPhoto = true;
    }
    drop(SOURCE_KEYS);
  };

  // Неоплаченный заказ старше 7 дней — истёк, удаляем всё.
  const unpaid = !order.paidAt && (UNPAID_STATUSES as readonly string[]).includes(order.status);
  if (unpaid && now - order.createdAt.getTime() > RETENTION.unpaidOrderMs) {
    plan.expire = order.status !== "expired";
    dropSource();
    drop(RESULT_KEYS);
    return plan;
  }
  // Уже истёкший — подчищаем файлы, если остались.
  if (order.status === "expired") {
    dropSource();
    drop(RESULT_KEYS);
    return plan;
  }

  // Возврат без доставки — всё удаляем через 30 дней после создания.
  if (order.status === "refunded" && !order.deliveredAt && now - order.createdAt.getTime() > RETENTION.videoAfterDeliveryMs) {
    dropSource();
    drop(RESULT_KEYS);
    return plan;
  }

  if (order.deliveredAt) {
    const sinceDelivery = now - order.deliveredAt.getTime();
    if (sinceDelivery > RETENTION.sourcePhotoAfterDeliveryMs) dropSource();
    if (sinceDelivery > RETENTION.videoAfterDeliveryMs) drop(RESULT_KEYS);
  }
  return plan;
}

export interface CleanupReport {
  checked: number;
  expired: number;
  filesDeleted: number;
  orphanUploads: number;
  errors: number;
}

async function safeDelete(key: string, report: CleanupReport) {
  try {
    await deleteObject(key);
    report.filesDeleted++;
  } catch (err) {
    report.errors++;
    console.error(`[cleanup] не удалось удалить ${key}:`, (err as Error).message);
  }
}

export async function runCleanup(now = new Date()): Promise<CleanupReport> {
  const report: CleanupReport = { checked: 0, expired: 0, filesDeleted: 0, orphanUploads: 0, errors: 0 };
  const t = now.getTime();

  // Кандидаты: неоплаченные старше 7 дней, истёкшие с файлами, доставленные/возвращённые старше 72 часов.
  const orders = await db.order.findMany({
    where: {
      OR: [
        { paidAt: null, createdAt: { lt: new Date(t - RETENTION.unpaidOrderMs) } },
        { status: "expired" },
        { deliveredAt: { lt: new Date(t - RETENTION.sourcePhotoAfterDeliveryMs) } },
        { status: "refunded", createdAt: { lt: new Date(t - RETENTION.videoAfterDeliveryMs) } },
      ],
    },
    select: { id: true, status: true, createdAt: true, paidAt: true, deliveredAt: true, roomPhotoKey: true, artifacts: true },
  });

  for (const row of orders) {
    report.checked++;
    const order: CleanupOrder = { ...row, artifacts: parseArtifacts(row.artifacts) };
    const plan = planCleanup(order, t);
    if (!plan.expire && plan.deleteKeys.length === 0) continue;

    for (const key of plan.deleteKeys) await safeDelete(key, report);

    const artifacts: Artifacts = { ...order.artifacts };
    for (const k of plan.dropArtifacts) delete artifacts[k];
    await db.order.update({
      where: { id: order.id },
      data: {
        artifacts: artifacts as Prisma.InputJsonObject,
        ...(plan.dropRoomPhoto ? { roomPhotoKey: null } : {}),
      },
    });

    if (plan.expire) {
      await transition(order.id, "expired", { comment: "Не оплачен 7 дней" }).catch((err) =>
        console.error(`[cleanup] заказ ${order.id}:`, (err as Error).message),
      );
      report.expired++;
    }
  }

  // Загрузки, к которым так и не создали заказ.
  const orphans = await db.upload.findMany({
    where: { orderId: null, createdAt: { lt: new Date(t - RETENTION.orphanUploadMs) } },
    select: { key: true },
  });
  for (const u of orphans) {
    await safeDelete(u.key, report);
    await db.upload.delete({ where: { key: u.key } });
    report.orphanUploads++;
  }

  console.log(`[cleanup] ${JSON.stringify(report)}`);
  return report;
}
