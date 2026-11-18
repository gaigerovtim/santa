/**
 * Повторная постановка видео в очередь (кнопка «Перегенерировать» в админке, восстановление).
 * Для автоматического пути после оплаты jobId фиксированный (`video-<id>`), здесь — уникальный,
 * потому что завершённая задача с тем же id в BullMQ не запускается заново.
 */
import { getQueue, QUEUE_VIDEO, type OrderJobData } from "./queue";

export async function requeueVideo(orderId: string, reason = "manual"): Promise<string> {
  const jobId = `video-${orderId}-${reason}-${Date.now()}`;
  await getQueue(QUEUE_VIDEO).add("video", { orderId } satisfies OrderJobData, { jobId, attempts: 1 });
  return jobId;
}
