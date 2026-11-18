/** Данные для админки: список заказов, счётчики за сегодня, карточка заказа. */
import type { OrderStatus, Prisma } from "@prisma/client";
import { parseArtifacts, type ArtifactKey } from "./artifacts";
import { db } from "./db";
import { ORDER_STATUSES, type OrderStatusName } from "./order-status";
import { presignDownload } from "./s3";

export const PAGE_SIZE = 30;

export const STATUS_LABELS: Record<OrderStatusName, string> = {
  created: "Создан",
  preview_generating: "Делаем кадр",
  preview_ready: "Кадр готов",
  paid: "Оплачен",
  generating: "Делаем видео",
  review: "На одобрении",
  delivered: "Доставлен",
  expired: "Истёк",
  needs_help: "Нужна помощь",
  refunded: "Возврат",
};

export function parseStatus(value: string | string[] | undefined): OrderStatusName | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && (ORDER_STATUSES as readonly string[]).includes(v) ? (v as OrderStatusName) : undefined;
}

/** Начало сегодняшнего дня по Москве (UTC+3, без перехода на летнее время). */
export function startOfTodayMsk(now = new Date()): Date {
  const MSK = 3 * 3600 * 1000;
  const DAY = 24 * 3600 * 1000;
  return new Date(Math.floor((now.getTime() + MSK) / DAY) * DAY - MSK);
}

export async function todayCounters(now = new Date()) {
  const since = startOfTodayMsk(now);
  const [orders, paid] = await Promise.all([
    db.order.count({ where: { createdAt: { gte: since } } }),
    db.order.aggregate({
      where: { paidAt: { gte: since }, status: { not: "refunded" } },
      _count: true,
      _sum: { amountRub: true },
    }),
  ]);
  return { orders, payments: paid._count, revenueRub: paid._sum.amountRub ?? 0 };
}

export async function listOrders(params: { status?: OrderStatusName; q?: string; page?: number }) {
  const where: Prisma.OrderWhereInput = {};
  if (params.status) where.status = params.status as OrderStatus;
  const q = params.q?.trim();
  if (q) where.email = { contains: q.toLowerCase(), mode: "insensitive" };
  const page = Math.max(1, params.page ?? 1);

  const [rows, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        createdAt: true,
        email: true,
        status: true,
        amountRub: true,
        costUsd: true,
        paidAt: true,
        lastError: true,
      },
    }),
    db.order.count({ where }),
  ]);
  return { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function orderDetails(id: string) {
  const order = await db.order.findUnique({
    where: { id },
    include: { events: { orderBy: { createdAt: "asc" } }, payments: { orderBy: { createdAt: "asc" } } },
  });
  if (!order) return null;

  // Администратору доступны все файлы заказа — по временным ссылкам (15 минут).
  const artifacts = parseArtifacts(order.artifacts);
  const sign = async (key?: string) => (key ? presignDownload(key) : null);
  const ids: ArtifactKey[] = ["room", "frameA", "preview", "frameB", "clip", "final"];
  const [original, ...signed] = await Promise.all([sign(order.roomPhotoKey ?? undefined), ...ids.map((k) => sign(artifacts[k]))]);
  const files = Object.fromEntries(ids.map((k, i) => [k, signed[i]])) as Record<ArtifactKey, string | null>;

  return { order, files: { original, ...files } };
}

const rub = new Intl.NumberFormat("ru-RU");
export const formatRub = (n: number) => `${rub.format(n)} ₽`;
export const formatUsd = (n: number | Prisma.Decimal) => `$${Number(n).toFixed(2)}`;
export const formatDateTime = (d: Date) =>
  d.toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
