import { describe, expect, it } from "vitest";
import {
  ORDER_STATUSES,
  TRANSITIONS,
  allowedFrom,
  canTransition,
  isPaidStatus,
} from "@/lib/order-status";

describe("переходы статусов", () => {
  it.each([
    ["created", "preview_generating"],
    ["preview_generating", "preview_ready"],
    ["preview_ready", "paid"],
    ["preview_ready", "preview_generating"],
    ["paid", "generating"],
    ["generating", "review"],
    ["generating", "delivered"],
    ["review", "delivered"],
    ["preview_generating", "needs_help"],
    ["generating", "needs_help"],
    ["needs_help", "generating"],
    ["paid", "refunded"],
    ["delivered", "refunded"],
    ["preview_ready", "expired"],
  ] as const)("разрешено %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each([
    ["created", "paid"],
    ["preview_generating", "paid"],
    ["created", "delivered"],
    ["preview_ready", "delivered"],
    ["paid", "preview_ready"],
    ["paid", "paid"],
    ["delivered", "paid"],
    ["expired", "paid"],
    ["expired", "preview_generating"],
    ["refunded", "delivered"],
    ["refunded", "paid"],
    ["preview_ready", "refunded"],
  ] as const)("запрещено %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it("конечные статусы expired и refunded без выходов", () => {
    expect(TRANSITIONS.expired).toEqual([]);
    expect(TRANSITIONS.refunded).toEqual([]);
  });

  it("каждый переход ведёт в существующий статус, без петель на себя", () => {
    for (const from of ORDER_STATUSES) {
      for (const to of TRANSITIONS[from]) {
        expect(ORDER_STATUSES).toContain(to);
        expect(to).not.toBe(from);
      }
    }
  });

  it("в paid можно попасть только из preview_ready", () => {
    expect(allowedFrom("paid")).toEqual(["preview_ready"]);
  });

  it("оплаченными считаются paid, generating, review, delivered", () => {
    expect(ORDER_STATUSES.filter(isPaidStatus)).toEqual([
      "paid",
      "generating",
      "review",
      "delivered",
    ]);
  });
});
