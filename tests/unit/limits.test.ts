import { beforeEach, describe, expect, it, vi } from "vitest";

const counts = { orders: 0, previews: 0 };

vi.mock("@/lib/db", () => ({
  db: {
    order: { count: vi.fn(async () => counts.orders) },
    orderEvent: { count: vi.fn(async () => counts.previews) },
  },
}));
vi.mock("@/lib/redis", () => ({ redis: vi.fn() }));
vi.mock("@/lib/env", () => ({ env: () => ({ IP_HASH_SALT: "salt" }) }));

import { checkOrderLimits, clientIp, hashIp, LIMITS, underLimit } from "@/lib/limits";

describe("лимиты", () => {
  beforeEach(() => {
    counts.orders = 0;
    counts.previews = 0;
  });

  it("3 заказа на email в сутки: третий можно, четвёртый нельзя", async () => {
    counts.orders = 2;
    expect(await checkOrderLimits("a@b.ru", "h")).toEqual({ ok: true });
    counts.orders = LIMITS.ordersPerEmailPerDay;
    expect(await checkOrderLimits("a@b.ru", "h")).toEqual({ ok: false, reason: "email_daily" });
  });

  it("5 превью в час с IP", async () => {
    counts.previews = 4;
    expect(await checkOrderLimits("a@b.ru", "h")).toEqual({ ok: true });
    counts.previews = 5;
    expect(await checkOrderLimits("a@b.ru", "h")).toEqual({ ok: false, reason: "ip_hourly" });
  });

  it("underLimit — строго меньше максимума", () => {
    expect(underLimit(0, 1)).toBe(true);
    expect(underLimit(1, 1)).toBe(false);
  });

  it("IP хешируется с солью, сам адрес не виден", () => {
    const h = hashIp("203.0.113.7", "salt");
    expect(h).toHaveLength(32);
    expect(h).not.toContain("203");
    expect(hashIp("203.0.113.7", "salt")).toBe(h);
    expect(hashIp("203.0.113.7", "other")).not.toBe(h);
  });

  it("IP: подставленный клиентом адрес в начале X-Forwarded-For не помогает обойти лимит", () => {
    // клиент прислал «1.1.1.1», наш прокси дописал реальный адрес в конец
    expect(clientIp(new Headers({ "x-forwarded-for": "1.1.1.1, 198.51.100.1" }))).toBe("198.51.100.1");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2", "x-forwarded-for": "1.1.1.1" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});
