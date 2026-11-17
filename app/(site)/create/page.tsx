import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CreateForm } from "@/components/create/CreateForm";
import { ServiceUnavailable } from "@/components/ServiceUnavailable";
import { site } from "@/config/site";
import { tariffs } from "@/config/tariffs";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Создать видео",
  robots: { index: false },
};

export default function CreatePage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-10 sm:px-6 sm:pt-10">
      <Link href="/" className="inline-flex min-h-11 items-center gap-2 font-display text-lg font-bold">
        <span className="font-mono text-xs text-santa" aria-hidden="true">
          ●
        </span>
        {site.shortName}
      </Link>
      <h1 className="sr-only">Создание видео с Дедом Морозом</h1>
      <div className="mt-6">
        <Suspense fallback={<p className="text-muted">Загружаем форму…</p>}>
          <CreateGate />
        </Suspense>
      </div>
    </main>
  );
}

/** Флаг приёма заказов читается при каждом запросе, а не при сборке. */
async function CreateGate() {
  await connection();
  if (!env().ORDERS_ENABLED) return <ServiceUnavailable />;
  return <CreateForm priceRub={tariffs[site.mainTariff].priceRub} />;
}
