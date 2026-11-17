import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: () => ({ MOCK_IMAGE_DELAY_SEC: 0, MOCK_VIDEO_DELAY_SEC: 0, MOCK_FAILURE_RATE: 0 }) }));

import { getImageProvider, getVideoProvider, ProviderNotConfiguredError } from "@/lib/providers";
import { callProvider, ProviderCallFailed, ProviderTimeoutError } from "@/lib/providers/call";
import { ProviderFatalError } from "@/lib/providers/types";

const quiet = { log: () => {}, backoffMs: 0 };

describe("выбор провайдера по AI_PROVIDER", () => {
  it("mock и mock2 — разные реализации одного интерфейса", () => {
    expect(getImageProvider({ AI_PROVIDER: "mock" }).name).toBe("mock");
    expect(getImageProvider({ AI_PROVIDER: "mock2" }).name).toBe("mock2");
    expect(getVideoProvider({ AI_PROVIDER: "mock2" }).name).toBe("mock2");
  });

  it("fal пока не подключён — понятная ошибка", () => {
    expect(() => getImageProvider({ AI_PROVIDER: "fal" })).toThrow(ProviderNotConfiguredError);
  });
});

describe("обёртка вызова провайдера", () => {
  it("успех с первой попытки — стоимость передаётся в учёт", async () => {
    const onSuccess = vi.fn();
    const r = await callProvider(async () => ({ costUsd: 0.04, v: 1 }), { label: "t", timeoutMs: 1000, onSuccess, ...quiet });
    expect(r.v).toBe(1);
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ costUsd: 0.04 }), 1, expect.any(Number));
  });

  it("до 2 повторов: сбой, сбой, успех", async () => {
    let n = 0;
    const onAttemptFailed = vi.fn();
    const r = await callProvider(
      async () => {
        n++;
        if (n < 3) throw new Error("сбой");
        return { costUsd: 0.01 };
      },
      { label: "t", timeoutMs: 1000, onAttemptFailed, ...quiet },
    );
    expect(r.costUsd).toBe(0.01);
    expect(n).toBe(3);
    expect(onAttemptFailed).toHaveBeenCalledTimes(2);
  });

  it("три неудачи подряд — ProviderCallFailed после 3 попыток", async () => {
    let n = 0;
    const err = await callProvider(
      async () => {
        n++;
        throw new Error("всегда сбой");
      },
      { label: "t", timeoutMs: 1000, ...quiet },
    ).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderCallFailed);
    expect(err.attempts).toBe(3);
    expect(n).toBe(3);
  });

  it("таймаут считается неудачной попыткой", async () => {
    const err = await callProvider(() => new Promise<{ costUsd: number }>(() => {}), {
      label: "t",
      timeoutMs: 20,
      retries: 0,
      ...quiet,
    }).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderCallFailed);
    expect(err.lastError).toBeInstanceOf(ProviderTimeoutError);
  });

  it("фатальную ошибку не повторяем", async () => {
    let n = 0;
    await callProvider(
      async () => {
        n++;
        throw new ProviderFatalError("запрещённый контент");
      },
      { label: "t", timeoutMs: 1000, ...quiet },
    ).catch(() => {});
    expect(n).toBe(1);
  });
});

describe("доступность заглушек", async () => {
  const { mocksAllowed } = await vi.importActual<typeof import("@/lib/env")>("@/lib/env");
  const base = { NODE_ENV: "production" as const, ENABLE_MOCKS: false };

  it("в продакшене /mock-pay и заглушки выключены", () => {
    expect(mocksAllowed(base)).toBe(false);
  });

  it("включаются явным флагом ENABLE_MOCKS или вне продакшена", () => {
    expect(mocksAllowed({ ...base, ENABLE_MOCKS: true })).toBe(true);
    expect(mocksAllowed({ ...base, NODE_ENV: "development" })).toBe(true);
  });
});
