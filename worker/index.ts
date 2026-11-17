/**
 * Воркер очередей. Этап 1: подключается к Redis и базе, слушает очереди preview и video.
 * Обработчики шагов конвейера появятся на этапах 4 и 6.
 */
import { Worker, type Job } from "bullmq";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { QUEUE_PREVIEW, QUEUE_VIDEO, type OrderJobData } from "@/lib/queue";
import { redis } from "@/lib/redis";

async function notImplemented(job: Job<OrderJobData>) {
  throw new Error(`Обработчик очереди ${job.queueName} ещё не реализован (заказ ${job.data.orderId})`);
}

async function main() {
  const e = env();
  await db.$queryRaw`SELECT 1`;
  await redis().ping();

  // BullMQ сам возвращает в очередь задачи, «застрявшие» после падения воркера (stalled jobs).
  const workers = [
    new Worker(QUEUE_PREVIEW, notImplemented, {
      connection: redis(),
      concurrency: e.PREVIEW_CONCURRENCY,
    }),
    new Worker(QUEUE_VIDEO, notImplemented, {
      connection: redis(),
      concurrency: e.VIDEO_CONCURRENCY,
    }),
  ];

  for (const w of workers) {
    w.on("failed", (job, err) => console.error(`[${w.name}] задача ${job?.id}:`, err.message));
  }

  console.log(
    `Воркер запущен: preview×${e.PREVIEW_CONCURRENCY}, video×${e.VIDEO_CONCURRENCY}, AI_PROVIDER=${e.AI_PROVIDER}`,
  );

  const shutdown = async (signal: string) => {
    console.log(`Получен ${signal}, останавливаю воркер…`);
    await Promise.all(workers.map((w) => w.close()));
    await redis().quit();
    await db.$disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Воркер не запустился:", err);
  process.exit(1);
});
