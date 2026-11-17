import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderScreen } from "@/components/order/OrderScreen";
import { site } from "@/config/site";
import { db } from "@/lib/db";
import { buildOrderView } from "@/lib/order-view";
import { SHARE_TOKEN_RE } from "@/lib/tokens";

export const metadata: Metadata = { title: "Ваш заказ", robots: { index: false } };

/** Страница заказа по секретной ссылке: меняет вид по статусу, опрашивает сервер каждые 3 секунды. */
export default function OrderPage({ params, searchParams }: PageProps<"/order/[token]">) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 font-display text-lg font-bold">
        <span className="font-mono text-xs text-santa" aria-hidden="true">
          ●
        </span>
        {site.shortName}
      </Link>
      <Suspense fallback={<p className="mt-8 text-muted">Загружаем заказ…</p>}>
        <OrderLoader params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function OrderLoader({
  params,
  searchParams,
}: Pick<PageProps<"/order/[token]">, "params" | "searchParams">) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  if (!SHARE_TOKEN_RE.test(token)) notFound();
  const order = await db.order.findUnique({ where: { shareToken: token } });
  if (!order) notFound();
  return (
    <OrderScreen
      token={token}
      initial={await buildOrderView(order)}
      paymentCanceled={query.payment === "canceled"}
    />
  );
}
