import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { site } from "@/config/site";
import { db } from "@/lib/db";
import { SHARE_TOKEN_RE } from "@/lib/tokens";

export const metadata: Metadata = { title: "Ваш заказ", robots: { index: false } };

// Временная страница заказа (этап 3). Опрос статуса и все экраны — этап 4.
export default function OrderPage({ params }: PageProps<"/order/[token]">) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 font-display text-lg font-bold">
        <span className="font-mono text-xs text-santa" aria-hidden="true">
          ●
        </span>
        {site.shortName}
      </Link>
      <Suspense fallback={<p className="mt-8 text-muted">Загружаем заказ…</p>}>
        <OrderStatus params={params} />
      </Suspense>
    </main>
  );
}

async function OrderStatus({ params }: { params: PageProps<"/order/[token]">["params"] }) {
  const { token } = await params;
  if (!SHARE_TOKEN_RE.test(token)) notFound();
  const order = await db.order.findUnique({
    where: { shareToken: token },
    select: { status: true, email: true },
  });
  if (!order) notFound();

  return (
    <section className="mt-8 rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-8" aria-live="polite">
      <p className="font-mono text-xs tracking-[0.2em] text-garland uppercase">Статус: {order.status}</p>
      <h1 className="mt-3 text-2xl font-bold sm:text-3xl">Дед Мороз собирается в путь…</h1>
      <p className="mt-3 text-muted">
        Заказ создан. Ссылку на эту страницу пришлём на {order.email}. Экран с кадром появится на следующем этапе
        разработки.
      </p>
    </section>
  );
}
