/**
 * Тарифы и конвейер генерации.
 * Цена берётся ТОЛЬКО отсюда, на сервере — из браузера её не принимаем.
 * Превью-задача выполняет шаги до previewFrom включительно, видео-задача — остальные
 * (docs/decisions.md, п. 1: frameB делается после оплаты).
 */
import type { PromptKey } from "./prompts";

export type StepType = "prepareRoomPhoto" | "editFrame" | "imageToVideo" | "postprocess";
export type ArtifactId = "frameA" | "frameB" | "preview" | "clip" | "final";
export type InputKind = "roomPhoto" | "childName" | "whisper" | "giftPhoto";

export type Step =
  | { type: "prepareRoomPhoto" }
  | { type: "editFrame"; id: ArtifactId; prompt: PromptKey; from?: ArtifactId }
  | {
      type: "imageToVideo";
      id: ArtifactId;
      first: ArtifactId;
      last?: ArtifactId;
      prompt: PromptKey;
      seconds: number;
    }
  | { type: "postprocess"; id: ArtifactId; preset: "camera" };

export interface Tariff {
  title: string;
  priceRub: number;
  format: "camera" | "cinema";
  inputs: readonly InputKind[];
  steps: readonly Step[];
  previewFrom: ArtifactId;
  enabled: boolean;
}

export const tariffs = {
  camera_visit: {
    title: "Визит Деда Мороза",
    priceRub: 390,
    format: "camera",
    inputs: ["roomPhoto"],
    steps: [
      { type: "prepareRoomPhoto" },
      { type: "editFrame", id: "frameA", prompt: "frameA_visit" },
      { type: "editFrame", id: "frameB", prompt: "frameB_remove", from: "frameA" },
      {
        type: "imageToVideo",
        id: "clip",
        first: "frameA",
        last: "frameB",
        prompt: "video_visit_camera",
        seconds: 10,
      },
      { type: "postprocess", id: "final", preset: "camera" },
    ],
    previewFrom: "frameA",
    enabled: true,
  },
  // Будущие тарифы: в интерфейсе версии 1 не показываются.
  camera_named: {
    title: "Визит с именем ребёнка",
    priceRub: 590,
    format: "camera",
    inputs: ["roomPhoto", "childName", "whisper", "giftPhoto"],
    steps: [],
    previewFrom: "frameA",
    enabled: false,
  },
  cinema: {
    title: "Кино",
    priceRub: 990,
    format: "cinema",
    inputs: ["roomPhoto", "childName"],
    steps: [],
    previewFrom: "frameA",
    enabled: false,
  },
} as const satisfies Record<string, Tariff>;

export type TariffKey = keyof typeof tariffs;

export const DEFAULT_TARIFF: TariffKey = "camera_visit";

export function isTariffKey(value: string): value is TariffKey {
  return Object.prototype.hasOwnProperty.call(tariffs, value);
}

/** Тариф, доступный для заказа, или null. */
export function getEnabledTariff(key: string): (Tariff & { key: TariffKey }) | null {
  if (!isTariffKey(key)) return null;
  const tariff: Tariff = tariffs[key];
  return tariff.enabled ? { ...tariff, key } : null;
}

/** Цена заказа — только из конфига. */
export function priceFor(key: string): number {
  const tariff = getEnabledTariff(key);
  if (!tariff) throw new Error(`Тариф недоступен: ${key}`);
  return tariff.priceRub;
}

/** Делит шаги на превью-часть (до previewFrom включительно) и видео-часть. */
export function splitSteps(tariff: Tariff): { preview: Step[]; video: Step[] } {
  const idx = tariff.steps.findIndex((s) => "id" in s && s.id === tariff.previewFrom);
  if (idx === -1) throw new Error(`previewFrom "${tariff.previewFrom}" не найден в шагах тарифа`);
  return {
    preview: tariff.steps.slice(0, idx + 1),
    video: tariff.steps.slice(idx + 1),
  };
}
