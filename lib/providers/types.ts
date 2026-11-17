/**
 * Интерфейсы провайдеров — точка подключения нейросетей и оплаты.
 * Шаги конвейера и API знают только эти интерфейсы; реализация выбирается
 * переменными AI_PROVIDER и PAYMENT_PROVIDER (lib/providers/index.ts).
 */

export interface ImageEditProvider {
  readonly name: string;
  editImage(input: {
    /** Фото комнаты, референс Деда Мороза и т. п. Первое — основное изображение. */
    images: Buffer[];
    prompt: string;
    /** Например, "16:9". */
    aspectRatio?: string;
  }): Promise<{ image: Buffer; costUsd: number }>;
}

export interface VideoProvider {
  readonly name: string;
  imageToVideo(input: {
    firstFrame: Buffer;
    lastFrame?: Buffer;
    prompt: string;
    negativePrompt?: string;
    seconds: number;
    resolution: "720p" | "1080p";
  }): Promise<{ video: Buffer; costUsd: number }>;
}

export interface PaymentProvider {
  readonly name: string;
  createPayment(input: {
    orderId: string;
    amountRub: number;
    description: string;
    returnUrl: string;
  }): Promise<{ paymentId: string; confirmationUrl: string }>;
  verifyPayment(paymentId: string): Promise<{
    status: "pending" | "succeeded" | "canceled";
    amountRub: number;
    orderId: string;
  }>;
  refund(paymentId: string, amountRub: number): Promise<void>;
}

/** Ошибка провайдера, которую не имеет смысла повторять (например, запрещённый контент). */
export class ProviderFatalError extends Error {
  readonly fatal = true;
}
