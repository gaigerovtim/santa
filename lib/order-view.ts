/**
 * Что покупатель видит по секретной ссылке. Правило доступа к файлам (ТЗ):
 * превью с водяным знаком — после готовности кадра; чистый кадр и видео — только после оплаты,
 * и только по временной ссылке хранилища (15 минут).
 */
import type { Order } from "@prisma/client";
import { parseArtifacts, type ArtifactKey } from "./artifacts";
import { LIMITS } from "./limits";
import { isPaidStatus, type OrderStatusName } from "./order-status";
import { presignDownload } from "./s3";

const PREVIEW_VISIBLE: readonly OrderStatusName[] = [
  "preview_ready",
  "paid",
  "generating",
  "review",
  "delivered",
  "needs_help",
];

/** Какие файлы заказа можно отдать при данном статусе. Чистая функция — проверяется тестами. */
export function exposedArtifacts(status: OrderStatusName): ArtifactKey[] {
  const out: ArtifactKey[] = [];
  if (PREVIEW_VISIBLE.includes(status)) out.push("preview");
  if (isPaidStatus(status)) out.push("frameA");
  if (status === "delivered") out.push("final");
  return out;
}

export interface OrderView {
  status: OrderStatusName;
  amountRub: number;
  email: string;
  regensLeft: number;
  previewUrl: string | null;
  frameUrl: string | null;
  videoUrl: string | null;
  downloadUrl: string | null;
  updatedAt: string;
}

/** Почта показывается частично: по ссылке её могут увидеть другие. */
export function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  const visible = name.length <= 2 ? name[0] : name.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(1, Math.min(6, name.length - visible.length)))}@${domain}`;
}

export async function buildOrderView(order: Order): Promise<OrderView> {
  const status = order.status as OrderStatusName;
  const artifacts = parseArtifacts(order.artifacts);
  const allowed = new Set(exposedArtifacts(status));
  const sign = (id: ArtifactKey, filename?: string) =>
    allowed.has(id) && artifacts[id] ? presignDownload(artifacts[id]!, filename) : Promise.resolve(null);

  const [previewUrl, frameUrl, videoUrl, downloadUrl] = await Promise.all([
    sign("preview"),
    sign("frameA"),
    sign("final"),
    sign("final", "ded-moroz-video.mp4"),
  ]);

  return {
    status,
    amountRub: order.amountRub,
    email: maskEmail(order.email),
    regensLeft: Math.max(0, LIMITS.previewRegensPerOrder - order.previewRegens),
    previewUrl,
    frameUrl,
    videoUrl,
    downloadUrl,
    updatedAt: order.updatedAt.toISOString(),
  };
}
