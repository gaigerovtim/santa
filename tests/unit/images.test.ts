import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: () => ({ MOCK_IMAGE_DELAY_SEC: 0, MOCK_FAILURE_RATE: 0 }) }));

import { mockImageProvider } from "@/lib/providers/mock/image";
import { makeWatermarkedPreview, PREVIEW_WIDTH } from "@/lib/watermark";
import { FRAME_H, FRAME_W, prepareRoomPhoto } from "@/worker/steps/prepare-room-photo";

const solid = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: "#203050" } }).jpeg().toBuffer();

describe("обработка изображений", () => {
  it("горизонтальное фото → 1920×1080", async () => {
    const out = await prepareRoomPhoto(await solid(4032, 3024));
    expect(await sharp(out).metadata()).toMatchObject({ width: FRAME_W, height: FRAME_H, format: "jpeg" });
  });

  it("вертикальное фото → 1920×1080 без обрезки (на размытом фоне)", async () => {
    const out = await prepareRoomPhoto(await solid(900, 1600));
    expect(await sharp(out).metadata()).toMatchObject({ width: FRAME_W, height: FRAME_H });
  });

  it("превью уменьшено до 1280 px и отличается от исходника (водяной знак)", async () => {
    const frame = await solid(1920, 1080);
    const preview = await makeWatermarkedPreview(frame);
    const meta = await sharp(preview).metadata();
    expect(meta.width).toBe(PREVIEW_WIDTH);
    const plain = await sharp(frame).resize({ width: PREVIEW_WIDTH }).raw().toBuffer();
    const marked = await sharp(preview).raw().toBuffer();
    let diff = 0;
    for (let i = 0; i < plain.length; i += 97) diff += Math.abs(plain[i] - marked[i]);
    expect(diff).toBeGreaterThan(1000);
  });

  it("mock-провайдер кадра возвращает изображение того же размера и условную стоимость", async () => {
    const room = await solid(1920, 1080);
    const { image, costUsd } = await mockImageProvider.editImage({ images: [room], prompt: "x" });
    expect(await sharp(image).metadata()).toMatchObject({ width: 1920, height: 1080 });
    expect(costUsd).toBeGreaterThan(0);
  });
});
