/**
 * Создание заказа: проверка загрузки и лимитов, цена из конфига, постановка в очередь превью.
 */
import { DEFAULT_TARIFF, getEnabledTariff } from "@/config/tariffs";
import { db } from "./db";
import { checkOrderLimits, LIMIT_MESSAGES, normalizeEmail, type LimitReason } from "./limits";
import { getQueue, QUEUE_PREVIEW, type OrderJobData } from "./queue";
import { headObject } from "./s3";
import type { CreateOrderInput } from "./schemas";
import { newShareToken } from "./tokens";
import { transition } from "./transition";
import { MAX_UPLOAD_BYTES, isAllowedUploadType } from "./upload-rules";

const UPLOAD_MAX_AGE_MS = 24 * 3600 * 1000;

export type CreateOrderResult =
  | { ok: true; token: string; orderId: string }
  | { ok: false; status: number; code: string; message: string };

export async function createOrder(input: CreateOrderInput, ipHash: string): Promise<CreateOrderResult> {
  const tariff = getEnabledTariff(input.tariff ?? DEFAULT_TARIFF);
  if (!tariff) return { ok: false, status: 400, code: "tariff", message: "Тариф недоступен" };

  // Загрузка должна быть выдана нами, свежей и ещё не привязанной к заказу.
  const upload = await db.upload.findUnique({ where: { key: input.photoKey } });
  if (!upload || upload.orderId || Date.now() - upload.createdAt.getTime() > UPLOAD_MAX_AGE_MS) {
    return { ok: false, status: 400, code: "upload", message: "Загрузите фото ещё раз" };
  }
  const object = await headObject(input.photoKey);
  if (!object || object.size > MAX_UPLOAD_BYTES || !isAllowedUploadType(object.contentType)) {
    return { ok: false, status: 400, code: "upload", message: "Фото не загрузилось. Попробуйте ещё раз" };
  }

  const email = normalizeEmail(input.email);
  const limits = await checkOrderLimits(email, ipHash);
  if (!limits.ok) {
    return { ok: false, status: 429, code: limits.reason, message: LIMIT_MESSAGES[limits.reason as LimitReason] };
  }

  const shareToken = newShareToken();
  const order = await db.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        tariff: tariff.key,
        amountRub: tariff.priceRub, // только из конфига
        email,
        roomPhotoKey: input.photoKey,
        shareToken,
        ipHash,
        consentAt: new Date(),
        events: { create: { fromStatus: null, toStatus: "created", actor: "customer" } },
      },
    });
    const claimed = await tx.upload.updateMany({
      where: { key: input.photoKey, orderId: null },
      data: { orderId: created.id },
    });
    if (claimed.count === 0) throw new Error("upload_already_used");
    await transition(created.id, "preview_generating", { comment: "Заказ создан" }, tx);
    return created;
  });

  await getQueue(QUEUE_PREVIEW).add(
    "preview",
    { orderId: order.id } satisfies OrderJobData,
    { jobId: `preview-${order.id}-0`, priority: 1, attempts: 1 },
  );

  return { ok: true, token: shareToken, orderId: order.id };
}
