/**
 * Воркер очередей: preview (кадр-превью) и video (после оплаты).
 */
import { Worker } from "bullmq";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { QUEUE_PREVIEW, QUEUE_VIDEO } from "@/lib/queue";
import { redis } from "@/lib/redis";
import { processPreview } from "./jobs/preview";
import { processVideo } from "./jobs/video";

async function main() {
  const e = env();
  await db.$queryRaw`SELECT 1`;
  await redis().ping();

  // BullMQ сам возвращает в очередь задачи, «застрявшие» после падения воркера (stalled jobs).
  const workers = [
    new Worker(QUEUE_PREVIEW, processPreview, {
      connection: redis(),
      concurrency: e.PREVIEW_CONCURRENCY,
    }),
    new Worker(QUEUE_VIDEO, processVideo, {
      connection: redis(),
      concurrency: e.VIDEO_CONCURRENCY,
      // Видео идёт минутами: блокировка задачи продлевается автоматически,
      // а если воркер упал — через lockDuration задача вернётся в очередь.
      lockDuration: 60_000,
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
