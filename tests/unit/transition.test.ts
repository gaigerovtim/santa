import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));

import { transition } from "@/lib/transition";
import { TransitionError, type OrderStatusName } from "@/lib/order-status";

/** Минимальная имитация транзакционного клиента Prisma в памяти. */
function fakeTx(initial: OrderStatusName | null) {
  const state = { status: initial, paidAt: null as Date | null };
  const events: Array<{ fromStatus: string; toStatus: string; actor: string }> = [];
  const tx = {
    order: {
      findUnique: vi.fn(async () => (state.status ? { status: state.status } : null)),
      findUniqueOrThrow: vi.fn(async () => ({ id: "o1", ...state })),
      updateMany: vi.fn(
        async ({ where, data }: { where: { status: string }; data: Record<string, unknown> }) => {
          if (state.status !== where.status) return { count: 0 };
          state.status = data.status as OrderStatusName;
          if (data.paidAt) state.paidAt = data.paidAt as Date;
          return { count: 1 };
        },
      ),
    },
    orderEvent: {
      create: vi.fn(async ({ data }: { data: (typeof events)[number] }) => {
        events.push(data);
        return data;
      }),
    },
  };
  return { tx, state, events };
}

describe("transition()", () => {
  it("переводит заказ и пишет событие в историю", async () => {
    const { tx, state, events } = fakeTx("preview_ready");
    // @ts-expect-error — упрощённый клиент
    const order = await transition("o1", "paid", { comment: "webhook" }, tx);
    expect(order?.status).toBe("paid");
    expect(state.paidAt).toBeInstanceOf(Date);
    expect(events).toEqual([
      expect.objectContaining({ fromStatus: "preview_ready", toStatus: "paid", actor: "system" }),
    ]);
  });

  it("запрещённый переход — ошибка, статус и история не меняются", async () => {
    const { tx, state, events } = fakeTx("created");
    // @ts-expect-error — упрощённый клиент
    await expect(transition("o1", "paid", {}, tx)).rejects.toBeInstanceOf(TransitionError);
    expect(state.status).toBe("created");
    expect(events).toHaveLength(0);
  });

  it("несуществующий заказ — ошибка", async () => {
    const { tx } = fakeTx(null);
    // @ts-expect-error — упрощённый клиент
    await expect(transition("o1", "paid", {}, tx)).rejects.toBeInstanceOf(TransitionError);
  });

  it("повторный перевод в тот же статус с allowSame ничего не меняет", async () => {
    const { tx, events } = fakeTx("paid");
    // @ts-expect-error — упрощённый клиент
    const result = await transition("o1", "paid", { allowSame: true }, tx);
    expect(result).toBeNull();
    expect(events).toHaveLength(0);
    expect(tx.order.updateMany).not.toHaveBeenCalled();
  });

  it("повторный перевод без allowSame — ошибка", async () => {
    const { tx } = fakeTx("paid");
    // @ts-expect-error — упрощённый клиент
    await expect(transition("o1", "paid", {}, tx)).rejects.toBeInstanceOf(TransitionError);
  });

  it("если статус успели сменить параллельно — переход не проводится", async () => {
    const { tx, state, events } = fakeTx("preview_ready");
    tx.order.updateMany.mockImplementationOnce(async () => {
      state.status = "paid"; // другой процесс уже оплатил
      return { count: 0 };
    });
    // @ts-expect-error — упрощённый клиент
    const result = await transition("o1", "paid", { allowSame: true }, tx);
    expect(result).toBeNull();
    expect(events).toHaveLength(0);
  });

  it("записывает автора-администратора", async () => {
    const { tx, events } = fakeTx("review");
    // @ts-expect-error — упрощённый клиент
    await transition("o1", "delivered", { actor: "admin" }, tx);
    expect(events[0].actor).toBe("admin");
  });
});
