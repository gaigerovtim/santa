import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LogoutButton, ManualApprovalToggle } from "@/components/admin/AdminControls";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { requireAdmin } from "@/lib/admin-auth";
import {
  STATUS_LABELS,
  formatDateTime,
  formatRub,
  formatUsd,
  listOrders,
  parseStatus,
  todayCounters,
} from "@/lib/admin-data";
import { ORDER_STATUSES } from "@/lib/order-status";
import { getManualApproval } from "@/lib/settings";

// Шаблон заголовка из app/admin/layout.tsx действует только на вложенные страницы — здесь задаём целиком.
export const metadata: Metadata = { title: { absolute: "Заказы — Админка" } };

export default function AdminOrdersPage({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<p className="text-muted">Загружаем…</p>}>
      <Orders searchParams={searchParams} />
    </Suspense>
  );
}

async function Orders({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  await requireAdmin();
  const sp = await searchParams;
  const status = parseStatus(sp.status);
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const page = Number(typeof sp.page === "string" ? sp.page : 1) || 1;

  const [counters, list, manual] = await Promise.all([
    todayCounters(),
    listOrders({ status, q, page }),
    getManualApproval(),
  ]);

  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/admin?${s}` : "/admin";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold sm:text-3xl">Заказы</h1>
        <LogoutButton />
      </div>

      {/* Счётчики за сегодня */}
      <section aria-label="Сегодня" className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          ["Заказов сегодня", String(counters.orders)],
          ["Оплат", String(counters.payments)],
          ["Выручка", formatRub(counters.revenueRub)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-surface p-3 sm:p-5">
            <p className="text-xs text-muted sm:text-sm">{label}</p>
            <p className="mt-1 font-display text-xl font-bold sm:text-3xl">{value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5" aria-label="Настройки">
        <ManualApprovalToggle initial={manual} />
      </section>

      {/* Фильтр и поиск — обычная GET-форма: работает без JS, ссылкой можно поделиться */}
      <form method="get" action="/admin" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1 block text-sm text-muted">Поиск по email</span>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="name@example.ru"
            className="block min-h-11 w-full rounded-xl border border-line bg-surface px-4 focus:border-garland focus:outline-none"
          />
        </label>
        <label className="sm:w-56">
          <span className="mb-1 block text-sm text-muted">Статус</span>
          <select
            name="status"
            defaultValue={status ?? ""}
            className="block min-h-11 w-full rounded-xl border border-line bg-surface px-3 focus:border-garland focus:outline-none"
          >
            <option value="">Все статусы</option>
            {ORDER_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-xl border border-garland/50 px-5 font-semibold text-garland hover:bg-garland/10"
        >
          Показать
        </button>
      </form>

      <p className="text-sm text-muted">
        Найдено: {list.total}
        {(status || q) && (
          <>
            {" · "}
            <Link href="/admin" className="text-garland underline">
              сбросить фильтр
            </Link>
          </>
        )}
      </p>

      {list.rows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-6 text-center text-muted">Заказов нет</p>
      ) : (
        <>
          {/* Телефон: карточки */}
          <ul className="space-y-3 md:hidden">
            {list.rows.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="block rounded-2xl border border-line bg-surface p-4 hover:border-garland/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 truncate font-semibold">{o.email}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                    <span>{formatDateTime(o.createdAt)}</span>
                    <span>{formatRub(o.amountRub)}</span>
                    <span>генерация {formatUsd(o.costUsd)}</span>
                  </div>
                  {o.lastError && <p className="mt-2 truncate text-sm text-danger">{o.lastError}</p>}
                </Link>
              </li>
            ))}
          </ul>

          {/* Компьютер и планшет: таблица */}
          <div className="hidden overflow-hidden rounded-2xl border border-line md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Дата</th>
                  <th scope="col" className="px-4 py-3 font-medium">Email</th>
                  <th scope="col" className="px-4 py-3 font-medium">Статус</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Сумма</th>
                  <th scope="col" className="px-4 py-3 text-right font-medium">Генерация</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {list.rows.map((o) => (
                  <tr key={o.id} className="hover:bg-surface/60">
                    <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDateTime(o.createdAt)}</td>
                    <td className="max-w-xs px-4 py-3">
                      <Link href={`/admin/orders/${o.id}`} className="block truncate font-semibold hover:text-garland">
                        {o.email}
                      </Link>
                      {o.lastError && <span className="block truncate text-xs text-danger">{o.lastError}</span>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">{formatRub(o.amountRub)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap text-muted">{formatUsd(o.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {list.pages > 1 && (
        <nav aria-label="Страницы" className="flex items-center justify-between gap-3">
          {list.page > 1 ? (
            <Link href={pageHref(list.page - 1)} className="min-h-11 rounded-xl border border-line px-4 py-2.5 hover:border-garland">
              ← Назад
            </Link>
          ) : <span />}
          <span className="text-sm text-muted">Страница {list.page} из {list.pages}</span>
          {list.page < list.pages ? (
            <Link href={pageHref(list.page + 1)} className="min-h-11 rounded-xl border border-line px-4 py-2.5 hover:border-garland">
              Дальше →
            </Link>
          ) : <span />}
        </nav>
      )}
    </div>
  );
}
