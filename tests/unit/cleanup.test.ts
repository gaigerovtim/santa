import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/s3", () => ({ deleteObject: vi.fn() }));
vi.mock("@/lib/transition", () => ({ transition: vi.fn() }));

import { planCleanup, type CleanupOrder } from "@/lib/cleanup";

const NOW = Date.UTC(2027, 0, 20, 12);
const H = 3600 * 1000;
const D = 24 * H;
const ago = (ms: number) => new Date(NOW - ms);

const files = {
  room: "orders/o/room.jpg",
  frameA: "orders/o/frameA.jpg",
  preview: "orders/o/preview.jpg",
  frameB: "orders/o/frameB.jpg",
  clip: "orders/o/clip.mp4",
  final: "orders/o/final.mp4",
};

function order(extra: Partial<CleanupOrder>): CleanupOrder {
  return {
    id: "o",
    status: "delivered",
    createdAt: ago(40 * D),
    paidAt: ago(40 * D),
    deliveredAt: ago(40 * D),
    roomPhotoKey: "uploads/2026-12-10/x.jpg",
    artifacts: { ...files },
    ...extra,
  };
}

describe("очистка по срокам хранения", () => {
  it("исходное фото удаляется через 72 часа после доставки, видео остаётся", () => {
    const plan = planCleanup(order({ deliveredAt: ago(73 * H) }), NOW);
    expect(plan.deleteKeys).toEqual(["uploads/2026-12-10/x.jpg", "orders/o/room.jpg"]);
    expect(plan.dropRoomPhoto).toBe(true);
    expect(plan.deleteKeys).not.toContain("orders/o/final.mp4");
  });

  it("до 72 часов после доставки ничего не трогаем", () => {
    const plan = planCleanup(order({ deliveredAt: ago(71 * H) }), NOW);
    expect(plan.deleteKeys).toEqual([]);
  });

  it("видео и кадры удаляются через 30 дней после доставки", () => {
    const plan = planCleanup(order({ deliveredAt: ago(31 * D) }), NOW);
    expect(plan.deleteKeys).toEqual(expect.arrayContaining(["orders/o/final.mp4", "orders/o/clip.mp4", "orders/o/preview.jpg"]));
    expect(plan.expire).toBe(false);
  });

  it("неоплаченный заказ старше 7 дней — истёк, удаляется всё", () => {
    const plan = planCleanup(
      order({ status: "preview_ready", paidAt: null, deliveredAt: null, createdAt: ago(8 * D) }),
      NOW,
    );
    expect(plan.expire).toBe(true);
    expect(plan.deleteKeys).toHaveLength(7);
  });

  it("неоплаченный младше 7 дней — не трогаем", () => {
    const plan = planCleanup(
      order({ status: "preview_ready", paidAt: null, deliveredAt: null, createdAt: ago(6 * D) }),
      NOW,
    );
    expect(plan).toMatchObject({ expire: false, deleteKeys: [] });
  });

  it("оплаченный, но ещё не доставленный (на одобрении) не истекает", () => {
    const plan = planCleanup(order({ status: "review", deliveredAt: null, createdAt: ago(10 * D) }), NOW);
    expect(plan).toMatchObject({ expire: false, deleteKeys: [] });
  });

  it("повторный запуск по уже очищенному заказу ничего не делает", () => {
    const plan = planCleanup(order({ roomPhotoKey: null, artifacts: {}, deliveredAt: ago(40 * D) }), NOW);
    expect(plan.deleteKeys).toEqual([]);
  });

  it("возврат без доставки — файлы удаляются через 30 дней", () => {
    const plan = planCleanup(order({ status: "refunded", deliveredAt: null, createdAt: ago(31 * D) }), NOW);
    expect(plan.deleteKeys).toHaveLength(7);
  });
});
