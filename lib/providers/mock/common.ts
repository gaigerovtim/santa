import path from "node:path";
import { env } from "@/lib/env";

/** Папка с файлами-заглушками (assets/mock). В Docker — /app/assets/mock. */
export const MOCK_DIR = path.join(process.cwd(), "assets", "mock");

/** Задержка «как у настоящего сервиса»: значение из .env ±25 %. */
export async function mockDelay(baseSec: number): Promise<void> {
  if (baseSec <= 0) return;
  const jitter = 0.75 + Math.random() * 0.5;
  await new Promise((r) => setTimeout(r, baseSec * jitter * 1000));
}

/** Случайная ошибка с вероятностью MOCK_FAILURE_RATE. */
export function maybeFail(what: string, rate = env().MOCK_FAILURE_RATE): void {
  if (rate > 0 && Math.random() < rate) {
    throw new Error(`Заглушка ${what}: имитация сбоя (MOCK_FAILURE_RATE=${rate})`);
  }
}
