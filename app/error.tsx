"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/Button";

/** Общая страница ошибки: что-то сломалось при отрисовке страницы. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16 sm:px-6">
      <p className="font-mono text-xs tracking-[0.2em] text-garland uppercase">Сбой записи</p>
      <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Что-то пошло не так</h1>
      <p className="mt-3 text-muted">
        Мы уже знаем об ошибке. Попробуйте обновить страницу — заказ и оплата никуда не денутся.
      </p>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted">Код ошибки: {error.digest}</p>}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button onClick={reset}>Попробовать ещё раз</Button>
        <ButtonLink href="/" variant="secondary">
          На главную
        </ButtonLink>
      </div>
    </main>
  );
}
