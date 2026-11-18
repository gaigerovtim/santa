/**
 * Ставит в очередь video все оплаченные заказы, которые застряли в статусе paid
 * (например, оплачены, когда воркер ещё не умел делать видео, или очередь Redis очищалась).
 * Запуск в Docker: docker compose exec worker npx tsx scripts/requeue-paid.ts
 */
import { db } from "@/lib/db";
import { getQueue, QUEUE_VIDEO } from "@/lib/queue";
import { redis } from "@/lib/redis";
import { requeueVideo } from "@/lib/video-queue";

async function main() {
  const stuck = await db.order.findMany({ where: { status: "paid" }, select: { id: true, paidAt: true } });
  for (const order of stuck) {
    const jobId = await requeueVideo(order.id, "requeue");
    console.log(`Заказ ${order.id} (оплачен ${order.paidAt?.toISOString()}) → задача ${jobId}`);
  }
  console.log(stuck.length ? `Поставлено в очередь: ${stuck.length}` : "Застрявших оплаченных заказов нет");
  await getQueue(QUEUE_VIDEO).close();
  await redis().quit();
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
