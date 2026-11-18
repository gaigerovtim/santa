import path from "node:path";
import { env, mocksAllowed } from "@/lib/env";
import { redis } from "@/lib/redis";

/** Папка с файлами-заглушками (assets/mock). В Docker — /app/assets/mock. */
export const MOCK_DIR = path.join(process.cwd(), "assets", "mock");

/**
 * Настройки заглушек на лету — для e2e и нагрузочного теста, без перезапуска воркера.
 * Хеш Redis `mock:config`: image_delay, video_delay (секунды), failure_rate (0…1).
 * Действует только там, где разрешены заглушки; иначе — значения из .env.
 */
export const MOCK_CONFIG_KEY = "mock:config";

export interface MockConfig {
  imageDelaySec: number;
  videoDelaySec: number;
  failureRate: number;
}

export async function getMockConfig(): Promise<MockConfig> {
  const e = env();
  const base = {
    imageDelaySec: e.MOCK_IMAGE_DELAY_SEC,
    videoDelaySec: e.MOCK_VIDEO_DELAY_SEC,
    failureRate: e.MOCK_FAILURE_RATE,
  };
  if (!mocksAllowed(e)) return base;
  try {
    const o = await redis().hgetall(MOCK_CONFIG_KEY);
    const num = (v: string | undefined, fallback: number) =>
      v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : fallback;
    return {
      imageDelaySec: num(o.image_delay, base.imageDelaySec),
      videoDelaySec: num(o.video_delay, base.videoDelaySec),
      failureRate: Math.min(1, Math.max(0, num(o.failure_rate, base.failureRate))),
    };
  } catch {
    return base;
  }
}

/** Задержка «как у настоящего сервиса»: значение ±25 %. */
export async function mockDelay(baseSec: number): Promise<void> {
  if (baseSec <= 0) return;
  const jitter = 0.75 + Math.random() * 0.5;
  await new Promise((r) => setTimeout(r, baseSec * jitter * 1000));
}

/** Случайная ошибка с заданной вероятностью. */
export function maybeFail(what: string, rate: number): void {
  if (rate > 0 && Math.random() < rate) {
    throw new Error(`Заглушка ${what}: имитация сбоя (вероятность ${rate})`);
  }
}
