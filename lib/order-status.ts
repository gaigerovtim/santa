/**
 * Статусы заказа и допустимые переходы. Чистый модуль без базы — его тестируем отдельно.
 */
export const ORDER_STATUSES = [
  "created",
  "preview_generating",
  "preview_ready",
  "paid",
  "generating",
  "review",
  "delivered",
  "expired",
  "needs_help",
  "refunded",
] as const;

export type OrderStatusName = (typeof ORDER_STATUSES)[number];

export const TRANSITIONS: Record<OrderStatusName, readonly OrderStatusName[]> = {
  created: ["preview_generating", "expired"],
  preview_generating: ["preview_ready", "needs_help", "expired"],
  // preview_generating — перегенерация превью
  preview_ready: ["preview_generating", "paid", "expired"],
  paid: ["generating", "needs_help", "refunded"],
  generating: ["review", "delivered", "needs_help", "refunded"],
  // generating — администратор отправил на перегенерацию
  review: ["delivered", "generating", "needs_help", "refunded"],
  delivered: ["generating", "refunded"],
  needs_help: ["preview_generating", "generating", "review", "delivered", "refunded", "expired"],
  expired: [],
  refunded: [],
};

export function canTransition(from: OrderStatusName, to: OrderStatusName): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Статусы, из которых можно перейти в `to`. */
export function allowedFrom(to: OrderStatusName): OrderStatusName[] {
  return ORDER_STATUSES.filter((from) => canTransition(from, to));
}

/** После этих статусов заказ оплачен: можно отдавать чистый кадр и видео. */
export const PAID_STATUSES: readonly OrderStatusName[] = [
  "paid",
  "generating",
  "review",
  "delivered",
];

export function isPaidStatus(status: OrderStatusName): boolean {
  return PAID_STATUSES.includes(status);
}

export class TransitionError extends Error {
  constructor(
    public readonly from: OrderStatusName | null,
    public readonly to: OrderStatusName,
  ) {
    super(from ? `Недопустимый переход ${from} → ${to}` : `Заказ не найден для перехода в ${to}`);
    this.name = "TransitionError";
  }
}
