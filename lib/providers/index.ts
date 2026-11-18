/**
 * Выбор реализации провайдеров по переменным окружения.
 * Подключить новый сервис = добавить реализацию интерфейса и ветку здесь.
 */
import { env, type Env } from "@/lib/env";
import { mockImageProvider } from "./mock/image";
import { mockVideoProvider } from "./mock/video";
import { mock2ImageProvider, mock2VideoProvider } from "./mock2";
import type { ImageEditProvider, PaymentProvider, VideoProvider } from "./types";

export class ProviderNotConfiguredError extends Error {}

export function getImageProvider(e: Pick<Env, "AI_PROVIDER"> = env()): ImageEditProvider {
  switch (e.AI_PROVIDER) {
    case "mock":
      return mockImageProvider;
    case "mock2":
      return mock2ImageProvider;
    case "fal":
      throw new ProviderNotConfiguredError("AI_PROVIDER=fal: реализация появится на следующем этапе");
  }
}

export function getVideoProvider(e: Pick<Env, "AI_PROVIDER"> = env()): VideoProvider {
  switch (e.AI_PROVIDER) {
    case "mock":
      return mockVideoProvider;
    case "mock2":
      return mock2VideoProvider;
    case "fal":
      throw new ProviderNotConfiguredError("AI_PROVIDER=fal: реализация появится на следующем этапе");
  }
}

/** Провайдер оплаты: mock — тестовая страница /mock-pay, robokassa — Robokassa (в т. ч. тестовый режим). */
export async function getPaymentProvider(e: Pick<Env, "PAYMENT_PROVIDER"> = env()): Promise<PaymentProvider> {
  switch (e.PAYMENT_PROVIDER) {
    case "mock": {
      const { mockPaymentProvider } = await import("./mock/payment");
      return mockPaymentProvider;
    }
    case "robokassa": {
      const { robokassaProvider } = await import("./robokassa");
      return robokassaProvider;
    }
    case "yookassa":
      throw new ProviderNotConfiguredError("PAYMENT_PROVIDER=yookassa: реализация появится на следующем этапе");
  }
}
