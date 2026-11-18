/**
 * Запустить очистку по срокам хранения прямо сейчас (обычно она идёт сама в 04:00 МСК).
 * В Docker: docker compose exec worker npx tsx scripts/cleanup-now.ts
 */
import { runCleanup } from "@/lib/cleanup";
import { db } from "@/lib/db";

runCleanup()
  .then((report) => console.log("Готово:", report))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
