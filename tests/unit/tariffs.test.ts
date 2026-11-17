import { describe, expect, it } from "vitest";
import { getEnabledTariff, priceFor, splitSteps, tariffs } from "@/config/tariffs";

describe("тарифы", () => {
  it("цена «Визита Деда Мороза» — 390 ₽ из конфига", () => {
    expect(priceFor("camera_visit")).toBe(390);
  });

  it("выключенный или несуществующий тариф нельзя заказать", () => {
    expect(getEnabledTariff("cinema")).toBeNull();
    expect(getEnabledTariff("camera_named")).toBeNull();
    expect(getEnabledTariff("free")).toBeNull();
    expect(getEnabledTariff("__proto__")).toBeNull();
    expect(() => priceFor("cinema")).toThrow();
  });

  it("превью — шаги до frameA включительно, видео — остальные", () => {
    const { preview, video } = splitSteps(tariffs.camera_visit);
    expect(preview.map((s) => s.type)).toEqual(["prepareRoomPhoto", "editFrame"]);
    expect(video.map((s) => ("id" in s ? s.id : s.type))).toEqual(["frameB", "clip", "final"]);
  });
});
