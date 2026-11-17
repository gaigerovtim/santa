import { ButtonLink } from "./Button";

/** Заглушка при ORDERS_ENABLED=false. */
export function ServiceUnavailable() {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 text-center sm:p-10">
      <p className="font-mono text-xs tracking-[0.2em] text-garland uppercase">Нет сигнала</p>
      <h2 className="mt-3 text-2xl font-bold sm:text-3xl">Сервис временно недоступен</h2>
      <p className="mt-3 text-muted">
        Сейчас мы не принимаем новые заказы. Загляните чуть позже — Дед Мороз ещё успеет.
      </p>
      <ButtonLink href="/" variant="secondary" className="mt-6">
        На главную
      </ButtonLink>
    </div>
  );
}
