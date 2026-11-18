import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { OrderActions } from "@/components/admin/AdminControls";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ACTION_LABELS, availableActions } from "@/lib/admin-actions";
import { requireAdmin } from "@/lib/admin-auth";
import { STATUS_LABELS, formatDateTime, formatRub, formatUsd, orderDetails } from "@/lib/admin-data";
import type { OrderStatusName } from "@/lib/order-status";

export const metadata: Metadata = { title: "Заказ" };

export default function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Загружаем заказ…</p>}>
      <OrderCard params={params} />
    </Suspense>
  );
}

const ACTOR: Record<string, string> = { system: "система", admin: "администратор", customer: "покупатель" };

async function OrderCard({ params }: Pick<PageProps<"/admin/orders/[id]">, "params">) {
  await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const details = await orderDetails(id);
  if (!details) notFound();
  const { order, files } = details;
  const actions = availableActions(order).map((action) => ({ action, label: ACTION_LABELS[action] }));

  const images: Array<[string, string | null]> = [
    ["Исходное фото", files.original],
    ["Подготовленное (16:9)", files.room],
    ["Кадр A (с Дедом Морозом)", files.frameA],
    ["Превью для покупателя", files.preview],
    ["Кадр B (без Деда Мороза)", files.frameB],
  ];

  return (
    <div className="space-y-6">
      <Link href="/admin" className="inline-flex min-h-11 items-center text-sm text-muted hover:text-garland">
        ← Все заказы
      </Link>

      <header className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold sm:text-3xl">{order.email}</h1>
          <p className="mt-1 font-mono text-xs break-all text-muted">{order.id}</p>
        </div>
        <StatusBadge status={order.status} />
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Сумма", formatRub(order.amountRub)],
          ["Стоимость генерации", formatUsd(order.costUsd)],
          ["Вызовов провайдеров", String(order.attempts)],
          ["Перегенераций кадра", String(order.previewRegens)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-surface p-3 sm:p-4">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-lg font-semibold">{value}</p>
          </div>
        ))}
      </section>

      {order.lastError && (
        <section className="rounded-2xl border border-danger/50 bg-danger/10 p-4" aria-label="Ошибка">
          <p className="font-semibold text-danger">Последняя ошибка</p>
          <p className="mt-1 font-mono text-sm break-words">{order.lastError}</p>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <h2 className="mb-4 font-sans text-lg font-semibold">Действия</h2>
        <OrderActions orderId={order.id} actions={actions} />
      </section>

      <section>
        <h2 className="mb-3 font-sans text-lg font-semibold">Видео</h2>
        {files.final ? (
          <video src={files.final} controls playsInline preload="metadata" className="w-full max-w-3xl rounded-2xl border border-line bg-black" />
        ) : (
          <p className="text-muted">Финального видео пока нет{files.clip ? " (есть сырой ролик)" : ""}.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-sans text-lg font-semibold">Файлы</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {images.map(([label, url]) => (
            <figure key={label} className="overflow-hidden rounded-2xl border border-line bg-surface">
              {url ? (
                <a href={url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- временная ссылка хранилища */}
                  <img src={url} alt={label} className="aspect-video w-full bg-black object-contain" loading="lazy" />
                </a>
              ) : (
                <div className="flex aspect-video items-center justify-center text-sm text-muted">нет</div>
              )}
              <figcaption className="px-3 py-2 text-sm text-muted">{label}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-sans text-lg font-semibold">История</h2>
        <ol className="space-y-2">
          {order.events.map((e) => (
            <li key={String(e.id)} className="flex flex-col gap-1 rounded-xl border border-line bg-surface px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
              <span className="font-mono text-xs whitespace-nowrap text-muted">{formatDateTime(e.createdAt)}</span>
              <span className="text-sm">
                {e.fromStatus ? `${STATUS_LABELS[e.fromStatus as OrderStatusName]} → ` : ""}
                <strong>{STATUS_LABELS[e.toStatus as OrderStatusName]}</strong>
              </span>
              <span className="text-sm text-muted sm:ml-auto">
                {ACTOR[e.actor]}
                {e.comment ? ` · ${e.comment}` : ""}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {order.payments.length > 0 && (
        <section>
          <h2 className="mb-3 font-sans text-lg font-semibold">Платежи</h2>
          <ul className="space-y-2 text-sm">
            {order.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap gap-x-4 gap-y-1 rounded-xl border border-line bg-surface px-4 py-3">
                <span className="font-mono text-xs break-all text-muted">{p.id}</span>
                <span>{p.status}</span>
                <span>{formatRub(p.amountRub)}</span>
                {p.refundedRub > 0 && <span className="text-garland">возвращено {formatRub(p.refundedRub)}</span>}
                <span className="text-muted sm:ml-auto">{formatDateTime(p.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="text-sm text-muted">
        <p>
          Страница покупателя:{" "}
          <a href={`/order/${order.shareToken}`} target="_blank" rel="noreferrer" className="text-garland underline">
            открыть
          </a>
        </p>
        <p>Создан {formatDateTime(order.createdAt)}{order.paidAt ? ` · оплачен ${formatDateTime(order.paidAt)}` : ""}{order.deliveredAt ? ` · доставлен ${formatDateTime(order.deliveredAt)}` : ""}</p>
      </section>
    </div>
  );
}
