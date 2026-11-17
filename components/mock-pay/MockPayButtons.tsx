"use client";

import { useState } from "react";
import { Button } from "@/components/Button";

export function MockPayButtons({ paymentId, amountRub }: { paymentId: string; amountRub: number }) {
  const [busy, setBusy] = useState<null | "succeeded" | "canceled">(null);
  const [error, setError] = useState<string | null>(null);

  async function settle(outcome: "succeeded" | "canceled") {
    setBusy(outcome);
    setError(null);
    try {
      const res = await fetch(`/api/mock-pay/${paymentId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) throw new Error(data?.error?.message ?? "Не получилось");
      window.location.assign(data.redirect);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось");
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" className="w-full sm:w-auto" disabled={busy !== null} onClick={() => settle("succeeded")}>
          {busy === "succeeded" ? "Оплачиваем…" : `Оплатить ${amountRub} ₽`}
        </Button>
        <Button variant="secondary" size="lg" className="w-full sm:w-auto" disabled={busy !== null} onClick={() => settle("canceled")}>
          {busy === "canceled" ? "Отменяем…" : "Отказаться"}
        </Button>
      </div>
      {error && (
        <p className="mt-4 text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
