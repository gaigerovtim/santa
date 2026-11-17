/**
 * Общая обёртка вызова провайдера (ТЗ): таймаут, до 2 повторов при ошибке,
 * учёт стоимости успешного вызова, логирование. Запись в базу — через колбэки
 * onSuccess / onAttemptFailed, чтобы обёртку можно было тестировать без базы.
 */
import { ProviderFatalError } from "./types";

export interface CallOptions<T> {
  /** Что вызываем — для логов: "editFrame:frameA". */
  label: string;
  timeoutMs: number;
  /** Сколько раз повторить после первой неудачи. По ТЗ — 2. */
  retries?: number;
  /** Пауза перед повтором, мс (растёт: 1×, 2×). */
  backoffMs?: number;
  onAttemptFailed?: (attempt: number, error: Error) => void | Promise<void>;
  onSuccess?: (result: T, attempt: number, ms: number) => void | Promise<void>;
  log?: (msg: string) => void;
}

export class ProviderTimeoutError extends Error {}

export class ProviderCallFailed extends Error {
  constructor(
    message: string,
    public readonly attempts: number,
    public readonly lastError: Error,
  ) {
    super(message);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ProviderTimeoutError(`${label}: нет ответа за ${ms / 1000} с`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function callProvider<T extends { costUsd: number }>(
  fn: () => Promise<T>,
  opts: CallOptions<T>,
): Promise<T> {
  const { label, timeoutMs, retries = 2, backoffMs = 1000, log = console.log } = opts;
  let lastError: Error = new Error("неизвестная ошибка");

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const started = Date.now();
    try {
      const result = await withTimeout(fn(), timeoutMs, label);
      const ms = Date.now() - started;
      log(`[provider] ${label}: успех с попытки ${attempt} за ${ms} мс, $${result.costUsd}`);
      await opts.onSuccess?.(result, attempt, ms);
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      log(`[provider] ${label}: попытка ${attempt} не удалась — ${lastError.message}`);
      await opts.onAttemptFailed?.(attempt, lastError);
      if (lastError instanceof ProviderFatalError) break;
      if (attempt <= retries && backoffMs > 0) {
        await new Promise((r) => setTimeout(r, backoffMs * attempt));
      }
    }
  }

  throw new ProviderCallFailed(`${label}: не удалось после повторов — ${lastError.message}`, retries + 1, lastError);
}
