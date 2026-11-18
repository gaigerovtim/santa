import { beforeEach, describe, expect, it, vi } from "vitest";

const s = vi.hoisted(() => ({
  status: "paid",
  manual: true,
  failSteps: false,
  transitions: [] as string[],
  delivered: 0,
  delayedMails: 0,
  stepsRun: [] as string[],
}));

vi.mock("@/lib/db", () => ({
  db: {
    order: {
      findUnique: vi.fn(async () => ({ id: "o1", status: s.status, tariff: "camera_visit" })),
      update: vi.fn(async () => ({})),
    },
  },
}));
vi.mock("@/lib/transition", () => ({
  transition: vi.fn(async (_id: string, to: string) => {
    s.transitions.push(to);
    s.status = to;
    return { id: "o1", email: "a@b.ru", shareToken: "t", amountRub: 390 };
  }),
}));
vi.mock("@/lib/settings", () => ({ getManualApproval: async () => s.manual }));
vi.mock("@/lib/delivery", () => ({
  deliverOrder: vi.fn(async () => {
    s.delivered++;
    s.transitions.push("delivered");
  }),
}));
vi.mock("@/lib/notify", () => ({ notifyNeedsHelp: vi.fn(async () => s.delayedMails++) }));
vi.mock("@/worker/pipeline", () => ({
  loadContext: vi.fn(async () => ({})),
  runSteps: vi.fn(async (_ctx: unknown, steps: Array<{ type: string; id?: string }>) => {
    s.stepsRun = steps.map((x) => x.id ?? x.type);
    if (s.failSteps) throw new Error("провайдер не справился");
  }),
}));

import { processVideo } from "@/worker/jobs/video";

const job = { data: { orderId: "o1" } } as Parameters<typeof processVideo>[0];

describe("задача video", () => {
  beforeEach(() => {
    Object.assign(s, { status: "paid", manual: true, failSteps: false, transitions: [], delivered: 0, delayedMails: 0, stepsRun: [] });
  });

  it("выполняет шаги после превью: frameB, ролик, постобработка", async () => {
    await processVideo(job);
    expect(s.stepsRun).toEqual(["frameB", "clip", "final"]);
  });

  it("ручное одобрение включено → generating → review, без письма о готовности", async () => {
    await processVideo(job);
    expect(s.transitions).toEqual(["generating", "review"]);
    expect(s.delivered).toBe(0);
  });

  it("ручное одобрение выключено → сразу доставка", async () => {
    s.manual = false;
    await processVideo(job);
    expect(s.transitions).toEqual(["generating", "delivered"]);
    expect(s.delivered).toBe(1);
  });

  it("сбой → needs_help и письмо «Немного задерживаемся»", async () => {
    s.failSteps = true;
    await processVideo(job);
    expect(s.transitions).toEqual(["generating", "needs_help"]);
    expect(s.delayedMails).toBe(1);
  });

  it("повтор после перезапуска воркера (уже generating) продолжает без нового перехода", async () => {
    s.status = "generating";
    await processVideo(job);
    expect(s.transitions).toEqual(["review"]);
  });

  it("неоплаченный или уже доставленный заказ не трогает", async () => {
    for (const status of ["preview_ready", "delivered", "refunded"]) {
      s.status = status;
      s.transitions = [];
      await processVideo(job);
      expect(s.transitions).toEqual([]);
    }
  });
});
