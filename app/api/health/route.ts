import { connection } from "next/server";
import { db } from "@/lib/db";
import { redis } from "@/lib/redis";

/** Проверка живости для docker compose: база и Redis отвечают. */
export async function GET() {
  await connection();
  const checks: Record<string, "ok" | string> = {};

  try {
    await db.$queryRaw`SELECT 1`;
    checks.db = "ok";
  } catch (e) {
    checks.db = e instanceof Error ? e.message : "error";
  }

  try {
    checks.redis = (await redis().ping()) === "PONG" ? "ok" : "no pong";
  } catch (e) {
    checks.redis = e instanceof Error ? e.message : "error";
  }

  const ok = Object.values(checks).every((v) => v === "ok");
  return Response.json({ ok, checks }, { status: ok ? 200 : 503 });
}
