import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/s3", () => ({ presignDownload: vi.fn(async (key: string) => `https://signed/${key}`) }));
vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/redis", () => ({ redis: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: () => ({}) }));

import type { Order } from "@prisma/client";
import { buildOrderView, exposedArtifacts, maskEmail } from "@/lib/order-view";

const artifacts = {
  room: "orders/o/room.jpg",
  frameA: "orders/o/frameA.jpg",
  preview: "orders/o/preview.jpg",
  final: "orders/o/final.mp4",
};

function order(status: string, extra: Partial<Order> = {}): Order {
  return {
    status,
    artifacts,
    amountRub: 390,
    email: "anna@example.ru",
    previewRegens: 0,
    updatedAt: new Date(),
    ...extra,
  } as unknown as Order;
}

describe("доступ к файлам заказа", () => {
  it("до оплаты — только превью с водяным знаком", () => {
    expect(exposedArtifacts("preview_ready")).toEqual(["preview"]);
    expect(exposedArtifacts("preview_generating")).toEqual([]);
    expect(exposedArtifacts("expired")).toEqual([]);
  });

  it("после оплаты — чистый кадр; видео — только после доставки", () => {
    expect(exposedArtifacts("paid")).toEqual(["preview", "frameA"]);
    expect(exposedArtifacts("generating")).not.toContain("final");
    expect(exposedArtifacts("delivered")).toEqual(["preview", "frameA", "final"]);
  });

  it("исходное фото не отдаётся никогда", () => {
    for (const s of ["preview_ready", "paid", "delivered"] as const) {
      expect(exposedArtifacts(s)).not.toContain("room");
    }
  });

  it("ответ API до оплаты не содержит ссылок на чистый кадр и видео", async () => {
    const view = await buildOrderView(order("preview_ready"));
    expect(view.previewUrl).toBe("https://signed/orders/o/preview.jpg");
    expect(view.frameUrl).toBeNull();
    expect(view.videoUrl).toBeNull();
    expect(view.downloadUrl).toBeNull();
    expect(JSON.stringify(view)).not.toContain("frameA");
    expect(JSON.stringify(view)).not.toContain("room");
  });

  it("после доставки — ссылки на видео и скачивание", async () => {
    const view = await buildOrderView(order("delivered"));
    expect(view.videoUrl).toContain("final.mp4");
    expect(view.downloadUrl).toContain("final.mp4");
  });

  it("остаток перегенераций", async () => {
    expect((await buildOrderView(order("preview_ready"))).regensLeft).toBe(1);
    expect((await buildOrderView(order("preview_ready", { previewRegens: 1 }))).regensLeft).toBe(0);
  });

  it("почта по ссылке показывается частично", () => {
    expect(maskEmail("anna@example.ru")).toBe("an••@example.ru");
    expect(maskEmail("a@b.ru")).toBe("a•@b.ru");
  });
});
