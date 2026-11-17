import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { MockPayButtons } from "@/components/mock-pay/MockPayButtons";
import { site } from "@/config/site";
import { isTariffKey, tariffs } from "@/config/tariffs";
import { db } from "@/lib/db";
import { env, mocksAllowed } from "@/lib/env";

export const metadata: Metadata = { title: "Тестовая оплата", robots: { index: false } };

/** Тестовая оплата: только при PAYMENT_PROVIDER=mock и вне продакшена (или с ENABLE_MOCKS). */
export default function MockPayPage({ params }: PageProps<"/mock-pay/[id]">) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-10 pb-16 sm:px-6">
      <Suspense fallback={<p className="text-muted">Загружаем платёж…</p>}>
        <MockPay params={params} />
      </Suspense>
    </main>
  );
}

async function MockPay({ params }: { params: PageProps<"/mock-pay/[id]">["params"] }) {
  await connection();
  if (!mocksAllowed() || env().PAYMENT_PROVIDER !== "mock") notFound();
  const { id } = await params;
  const payment = await db.payment.findUnique({ where: { id }, include: { order: true } });
  if (!payment || payment.provider !== "mock") notFound();
  const title = isTariffKey(payment.order.tariff) ? tariffs[payment.order.tariff].title : site.name;

  return (
    <section className="rounded-[var(--radius-card)] border border-dashed border-garland/50 bg-surface p-6 sm:p-8">
      <p className="font-mono text-xs tracking-[0.2em] text-garland uppercase">Режим разработки · деньги не списываются</p>
      <h1 className="mt-3 text-3xl font-bold">Тестовая оплата</h1>
      <dl className="mt-6 space-y-2">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Получатель</dt>
          <dd>{site.name}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Назначение</dt>
          <dd className="text-right">{title}</dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-line pt-3 text-xl font-semibold">
          <dt>Сумма</dt>
          <dd>{payment.amountRub}&nbsp;₽</dd>
        </div>
      </dl>
      {payment.status === "pending" ? (
        <MockPayButtons paymentId={payment.id} amountRub={payment.amountRub} />
      ) : (
        <p className="mt-8 text-muted" role="status">
          Платёж уже {payment.status === "succeeded" ? "оплачен" : "отменён"}.{" "}
          <a className="text-garland underline" href={`/order/${payment.order.shareToken}`}>
            Вернуться к заказу
          </a>
        </p>
      )}
    </section>
  );
}
