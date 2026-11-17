/**
 * Второй фиктивный провайдер (AI_PROVIDER=mock2). Нужен только для проверки критерия ТЗ:
 * новый провайдер подключается реализацией интерфейса и сменой переменной окружения,
 * без правок страниц и бэкенда. Отличается подписью «ДЕМО-2» и стоимостью.
 */
import { env } from "@/lib/env";
import { maybeFail, mockDelay } from "../mock/common";
import { overlayDemo } from "../mock/image";
import { mockVideoProvider } from "../mock/video";
import type { ImageEditProvider, VideoProvider } from "../types";

export const mock2ImageProvider: ImageEditProvider = {
  name: "mock2",
  async editImage({ images }) {
    await mockDelay(env().MOCK_IMAGE_DELAY_SEC);
    maybeFail("кадра (mock2)");
    return { image: await overlayDemo(images[0], "ДЕМО-2"), costUsd: 0.02 };
  },
};

export const mock2VideoProvider: VideoProvider = {
  name: "mock2",
  async imageToVideo(input) {
    const { video } = await mockVideoProvider.imageToVideo(input);
    return { video, costUsd: 0.25 };
  },
};
