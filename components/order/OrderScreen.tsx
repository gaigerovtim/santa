"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/Button";
import { CameraFrame } from "@/components/CameraFrame";
import { IconCheck } from "@/components/icons";
import type { OrderView } from "@/lib/order-view";
import type { OrderStatusName } from "@/lib/order-status";

const POLL_MS = 3000;
/** В этих статусах больше ничего не изменится само — опрос не нужен. */
const FINAL: readonly OrderStatusName[] = ["delivered", "expired", "refunded"];

interface Props {
  token: string;
  initial: OrderView;
}

export function OrderScreen({ token, initial }: Props) {
  const [order, setOrder] = useState(initial);
  const [busy, setBusy] = useState<null | "pay" | "regen">(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${token}`, { cache: "no-store" });
      const data = await res.json();
      if (data?.ok) setOrder(data.order);
    } catch {
      /* временная потеря сети — попробуем на следующем шаге опроса */
    }
  }, [token]);

  // Опрос каждые 3 секунды, пока вкладка открыта и статус может измениться
  useEffect(() => {
    if (FINAL.includes(order.status)) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [order.status, refresh]);

  async function post(path: string) {
    const res = await fetch(`/api/orders/${token}/${path}`, { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) throw new Error(data?.error?.message ?? "Что-то пошло не так. Попробуйте ещё раз");
    return data;
  }

  async function pay() {
    setBusy("pay");
    setError(null);
    try {
      const { confirmationUrl } = await post("pay");
      window.location.assign(confirmationUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось перейти к оплате");
      setBusy(null);
    }
  }

  async function regenerate() {
    setBusy("regen");
    setError(null);
    try {
      await post("regenerate-preview");
      setOrder((o) => ({ ...o, status: "preview_generating", regensLeft: Math.max(0, o.regensLeft - 1) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось перегенерировать кадр");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6" aria-live="polite">
      <StatusBody order={order} busy={busy} onPay={pay} onRegenerate={regenerate} />
      {error && (
        <p className="mt-4 rounded-xl border border-danger/40 bg-danger/10 p-4 text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function StatusBody({
  order,
  busy,
  onPay,
  onRegenerate,
}: {
  order: OrderView;
  busy: null | "pay" | "regen";
  onPay: () => void;
  onRegenerate: () => void;
}) {
  switch (order.status) {
    case "created":
    case "preview_generating":
      return <Generating />;
    case "preview_ready":
      return <PreviewReady order={order} busy={busy} onPay={onPay} onRegenerate={onRegenerate} />;
    case "paid":
    case "generating":
    case "review":
      return <OnTheWay order={order} />;
    case "delivered":
      return <Delivered order={order} />;
    case "needs_help":
      return (
        <Message
          eyebrow="Немного задерживаемся"
          title="Мы уже разбираемся"
          text="Что-то пошло не так, но мы уже смотрим. Видео придёт на почту — эту страницу можно закрыть."
        />
      );
    case "expired":
      return (
        <Message eyebrow="Запись остановлена" title="Срок заказа истёк" text="Неоплаченные заказы хранятся 7 дней.">
          <ButtonLink href="/create" className="mt-6">
            Создать новый
          </ButtonLink>
        </Message>
      );
    case "refunded":
      return (
        <Message
          eyebrow="Возврат"
          title="Деньги возвращены"
          text="Возврат оформлен. Деньги обычно приходят на карту в течение нескольких дней."
        />
      );
  }
}

const CAPTIONS = [
  "Дед Мороз собирается в путь…",
  "Проверяем, горит ли гирлянда…",
  "Ищем место под ёлкой…",
  "Настраиваем камеру в гостиной…",
  "Упаковываем подарок…",
];

function Generating() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setI((n) => (n + 1) % CAPTIONS.length), 3200);
    return () => window.clearInterval(id);
  }, []);
  return (
    <section>
      <CameraFrame label="КАМЕРА 2 · ПОДКЛЮЧЕНИЕ">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_50%_60%,#1d2840,#05070c)]">
          <span className="h-12 w-12 animate-spin rounded-full border-2 border-garland/25 border-t-garland motion-reduce:animate-none" aria-hidden="true" />
          <span className="font-mono text-xs tracking-[0.25em] text-garland uppercase">Поиск сигнала</span>
        </div>
      </CameraFrame>
      <h1 className="mt-6 text-2xl font-bold sm:text-3xl" key={i}>
        {CAPTIONS[i]}
      </h1>
      <p className="mt-2 text-muted">Готовим бесплатный кадр с вашей комнатой — обычно до 1 минуты.</p>
    </section>
  );
}

function PreviewReady({
  order,
  busy,
  onPay,
  onRegenerate,
}: {
  order: OrderView;
  busy: null | "pay" | "regen";
  onPay: () => void;
  onRegenerate: () => void;
}) {
  return (
    <section>
      <CameraFrame>
        {order.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- временная ссылка хранилища
          <img
            src={order.previewUrl}
            alt="Кадр-превью: Дед Мороз у вашей ёлки (с водяным знаком)"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-black" />
        )}
      </CameraFrame>
      <h1 className="mt-6 text-2xl font-bold sm:text-3xl">Ваш кадр готов</h1>
      <p className="mt-2 text-muted">Так Дед Мороз появится в вашей комнате. В видео он положит подарок и уйдёт.</p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={onPay} disabled={busy !== null} aria-busy={busy === "pay"} className="w-full sm:w-auto">
          {busy === "pay" ? "Переходим к оплате…" : `Оплатить ${order.amountRub} ₽ и получить видео`}
        </Button>
        {order.regensLeft > 0 && (
          <Button
            variant="secondary"
            size="lg"
            onClick={onRegenerate}
            disabled={busy !== null}
            aria-busy={busy === "regen"}
            className="w-full sm:w-auto"
          >
            {busy === "regen" ? "Запускаем…" : "Перегенерировать кадр (1 раз бесплатно)"}
          </Button>
        )}
      </div>

      <div className="mt-8 rounded-[var(--radius-card)] border border-line bg-surface p-5 sm:p-6">
        <h2 className="font-sans text-base font-semibold">Что будет дальше</h2>
        <ul className="mt-3 space-y-2 text-muted">
          {[
            "После оплаты Дед Мороз отправится к вашей ёлке",
            "Видео 10 секунд придёт на почту за 10–15 минут",
            "Его можно скачать и показать на телевизоре",
          ].map((t) => (
            <li key={t} className="flex gap-2">
              <IconCheck className="mt-0.5 h-5 w-5 shrink-0 text-garland" />
              {t}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function OnTheWay({ order }: { order: OrderView }) {
  return (
    <section>
      <CameraFrame label="КАМЕРА 2 · ОЖИДАНИЕ">
        {order.frameUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- временная ссылка хранилища
          <img src={order.frameUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,#1d2840,#05070c)]" />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="h-12 w-12 animate-spin rounded-full border-2 border-garland/25 border-t-garland motion-reduce:animate-none" aria-hidden="true" />
        </div>
      </CameraFrame>
      <h1 className="mt-6 text-2xl font-bold sm:text-3xl">Дед Мороз уже в пути</h1>
      <p className="mt-2 text-muted">
        Видео придёт на почту {order.email} за 10–15 минут. Эту страницу можно закрыть — ссылка на неё есть в письме.
      </p>
    </section>
  );
}

function Delivered({ order }: { order: OrderView }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Дед Мороз у нашей ёлки", url });
        return;
      } catch {
        /* пользователь закрыл меню — ничего страшного */
        return;
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  return (
    <section>
      <CameraFrame>
        {order.videoUrl ? (
          <video
            src={order.videoUrl}
            poster={order.frameUrl ?? undefined}
            controls
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full bg-black object-contain"
          >
            Ваш браузер не показывает видео — скачайте файл кнопкой ниже.
          </video>
        ) : (
          <div className="absolute inset-0 bg-black" />
        )}
      </CameraFrame>
      <h1 className="mt-6 text-2xl font-bold sm:text-3xl">Ваше видео готово</h1>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {order.downloadUrl && (
          <a href={order.downloadUrl} download className="w-full sm:w-auto">
            <span className="inline-flex min-h-14 w-full items-center justify-center rounded-[var(--radius-button)] bg-santa px-7 text-lg font-semibold text-white transition hover:bg-santa-hover hover:shadow-glow-red">
              Скачать MP4
            </span>
          </a>
        )}
        <Button variant="secondary" size="lg" onClick={share} className="w-full sm:w-auto">
          {copied ? "Ссылка скопирована" : "Поделиться"}
        </Button>
      </div>
      <p className="mt-6 rounded-[var(--radius-card)] border border-garland/30 bg-garland/5 p-4">
        Совет: покажите видео утром 1 января на телевизоре — так «запись с камеры» выглядит убедительнее всего.
      </p>
      <p className="mt-3 text-sm text-muted">Видео хранится 30 дней — скачайте его, чтобы не потерять.</p>
    </section>
  );
}

function Message({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow: string;
  title: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="rounded-[var(--radius-card)] border border-line bg-surface p-6 sm:p-8">
      <p className="font-mono text-xs tracking-[0.2em] text-garland uppercase">{eyebrow}</p>
      <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{title}</h1>
      <p className="mt-3 text-muted">{text}</p>
      {children}
    </section>
  );
}
