"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/Button";

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error?.message ?? "Не получилось");
  return data;
}

/** Переключатель «Ручное одобрение». */
export function ManualApprovalToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const data = await postJson("/api/admin/settings", { manualApproval: !on });
      setOn(data.manualApproval);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Ручное одобрение видео"
        disabled={busy}
        onClick={toggle}
        className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors disabled:opacity-60 ${
          on ? "border-garland bg-garland/30" : "border-line bg-surface-2"
        }`}
      >
        <span
          className={`inline-block h-6 w-6 rounded-full bg-text shadow transition-transform ${on ? "translate-x-7" : "translate-x-1"}`}
        />
      </button>
      <div>
        <p className="font-semibold">Ручное одобрение</p>
        <p className="text-sm text-muted">
          {on ? "Готовое видео ждёт кнопки «Одобрить»" : "Готовое видео уходит покупателю сразу"}
        </p>
      </div>
      {error && <p role="alert" className="w-full text-sm text-danger">{error}</p>}
    </div>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        router.replace("/admin/login");
        router.refresh();
      }}
    >
      Выйти
    </Button>
  );
}

const CONFIRM: Partial<Record<string, string>> = {
  refund: "Вернуть деньги покупателю? Заказ перейдёт в статус «Возврат».",
  regenerate: "Перегенерировать? Текущий результат будет заменён.",
};

/** Кнопки действий в карточке заказа. */
export function OrderActions({
  orderId,
  actions,
}: {
  orderId: string;
  actions: Array<{ action: string; label: string }>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(action: string) {
    if (CONFIRM[action] && !window.confirm(CONFIRM[action])) return;
    setBusy(action);
    setMessage(null);
    try {
      const data = await postJson(`/api/admin/orders/${orderId}/${action}`);
      setMessage({ ok: true, text: data.message });
      router.refresh();
    } catch (e) {
      setMessage({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  if (!actions.length) return <p className="text-muted">В этом статусе действий нет.</p>;

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {actions.map(({ action, label }) => (
          <Button
            key={action}
            variant={action === "approve" ? "primary" : "secondary"}
            disabled={busy !== null}
            aria-busy={busy === action}
            onClick={() => run(action)}
            className="w-full sm:w-auto"
          >
            {busy === action ? "Выполняем…" : label}
          </Button>
        ))}
      </div>
      {message && (
        <p role="status" className={`mt-3 ${message.ok ? "text-success" : "text-danger"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
