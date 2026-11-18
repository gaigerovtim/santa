import type { Metadata } from "next";
import { ButtonLink } from "@/components/Button";
import { CameraFrame } from "@/components/CameraFrame";

export const metadata: Metadata = { title: "Страница не найдена" };

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-16 sm:px-6">
      <CameraFrame label="КАМЕРА 404 · НЕТ СИГНАЛА">
        <div className="absolute inset-0 flex items-center justify-center bg-[repeating-linear-gradient(0deg,#0a0d14_0px,#0a0d14_2px,#121826_2px,#121826_4px)]">
          <span className="font-mono text-4xl font-semibold tracking-[0.3em] text-white/70 sm:text-6xl">404</span>
        </div>
      </CameraFrame>
      <h1 className="mt-8 text-3xl font-bold sm:text-4xl">Здесь камера ничего не засняла</h1>
      <p className="mt-3 text-muted">
        Такой страницы нет. Если вы искали свой заказ — откройте ссылку из письма ещё раз.
      </p>
      <ButtonLink href="/" className="mt-8 self-start">
        На главную
      </ButtonLink>
    </main>
  );
}
