"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { IconCamera } from "@/components/icons";
import { Stepper } from "@/components/Stepper";
import { photoTips } from "@/config/home";
import { ApiError, NetworkError, createOrder, uploadPhoto } from "@/lib/client/api";
import { PrepareImageError, prepareImage, type PreparedImage } from "@/lib/client/prepare-image";
import { ACCEPTED_EXTENSIONS, ACCEPTED_INPUT_TYPES, MAX_UPLOAD_BYTES } from "@/lib/upload-rules";

type PhotoState =
  | { status: "empty" }
  | { status: "preparing"; name: string }
  | { status: "uploading"; image: PreparedImage; progress: number }
  | { status: "uploaded"; image: PreparedImage; key: string }
  | { status: "error"; message: string; image?: PreparedImage };

const STEPS = ["Фото комнаты", "Контакты"] as const;

export function CreateForm({ priceRub }: { priceRub: number }) {
  const router = useRouter();
  const ids = { file: useId(), email: useId(), personal: useId(), offer: useId(), status: useId() };
  const fileInput = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const uploadAbort = useRef<AbortController | null>(null);

  const [step, setStep] = useState<0 | 1>(0);
  const [photo, setPhoto] = useState<PhotoState>({ status: "empty" });
  const [portraitOk, setPortraitOk] = useState(false);
  const [dragging, setDragging] = useState(false);

  const [email, setEmail] = useState("");
  const [consentPersonal, setConsentPersonal] = useState(false);
  const [consentOffer, setConsentOffer] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Освобождаем память превью при замене фото и уходе со страницы
  const previewUrl = "image" in photo ? photo.image?.previewUrl : undefined;
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  // При смене шага переводим фокус на заголовок шага (для клавиатуры и экранных дикторов)
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const startUpload = useCallback(async (image: PreparedImage) => {
    uploadAbort.current?.abort();
    const controller = new AbortController();
    uploadAbort.current = controller;
    setPhoto({ status: "uploading", image, progress: 0 });
    try {
      const key = await uploadPhoto(
        image.blob,
        (progress) => setPhoto((p) => (p.status === "uploading" && p.image === image ? { ...p, progress } : p)),
        controller.signal,
      );
      setPhoto({ status: "uploaded", image, key });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message =
        err instanceof ApiError || err instanceof NetworkError ? err.message : "Не получилось загрузить фото";
      setPhoto({ status: "error", message, image });
    }
  }, []);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setPortraitOk(false);
      const typeOk = ACCEPTED_INPUT_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.test(file.name);
      if (!typeOk) {
        setPhoto({ status: "error", message: "Подойдёт фото в формате JPG, PNG, WEBP или HEIC" });
        return;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setPhoto({ status: "error", message: "Фото больше 15 МБ. Выберите снимок поменьше" });
        return;
      }
      setPhoto({ status: "preparing", name: file.name });
      try {
        const image = await prepareImage(file);
        await startUpload(image);
      } catch (err) {
        setPhoto({
          status: "error",
          message: err instanceof PrepareImageError ? err.message : "Не получилось открыть фото",
        });
      }
    },
    [startUpload],
  );

  // Форма приходит потоком и «оживает» не сразу. Если файл выбрали раньше (быстрый палец
  // на медленном телефоне), событие change до React не дошло — подхватываем файл при оживлении.
  useEffect(() => {
    const early = fileInput.current?.files?.[0];
    if (!early) return;
    if (fileInput.current) fileInput.current.value = "";
    queueMicrotask(() => void handleFile(early));
  }, [handleFile]);

  const pickFile = () => fileInput.current?.click();

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void handleFile(e.dataTransfer.files?.[0]);
  };

  const image = "image" in photo ? photo.image : undefined;
  const needsPortraitConfirm = !!image?.portrait && !portraitOk;
  const canContinue = photo.status === "uploaded" && !needsPortraitConfirm;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (photo.status !== "uploaded") return setStep(0);

    const errors: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = "Проверьте адрес почты";
    if (!consentPersonal) errors.consentPersonal = "Нужно согласие на обработку данных";
    if (!consentOffer) errors.consentOffer = "Нужно согласие с офертой";
    setFieldErrors(errors);
    setSubmitError(null);
    if (Object.keys(errors).length) return;

    setSubmitting(true);
    try {
      const { url } = await createOrder({ photoKey: photo.key, email, consentPersonal, consentOffer });
      router.push(url);
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ApiError) {
        if (err.fields) setFieldErrors(err.fields);
        if (err.code === "upload") {
          setPhoto({ status: "error", message: err.message, image: photo.image });
          setStep(0);
          return;
        }
      }
      setSubmitError(err instanceof Error ? err.message : "Не получилось создать заказ");
    }
  }

  const statusText =
    photo.status === "preparing"
      ? "Обрабатываем фото…"
      : photo.status === "uploading"
        ? `Загружаем фото: ${Math.round(photo.progress * 100)}%`
        : photo.status === "uploaded"
          ? "Фото загружено"
          : photo.status === "error"
            ? photo.message
            : "";

  return (
    <form onSubmit={onSubmit} noValidate className="pb-28 md:pb-0">
      <Stepper steps={STEPS} current={step} />

      {/* Объявления для экранных дикторов */}
      <p id={ids.status} className="sr-only" aria-live="polite" role="status">
        {photo.status === "uploading" ? "" : statusText}
      </p>

      {step === 0 && (
        <section className="mt-8" aria-labelledby="step-photo">
          <h2 id="step-photo" ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none sm:text-3xl">
            Загрузите фото комнаты
          </h2>
          <p className="mt-2 text-muted">С ёлкой целиком, горизонтально, вечером с гирляндой.</p>

          <input
            ref={fileInput}
            id={ids.file}
            type="file"
            accept={[...ACCEPTED_INPUT_TYPES, ".heic", ".heif"].join(",")}
            className="sr-only"
            aria-describedby={ids.status}
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = ""; // чтобы можно было выбрать тот же файл повторно
            }}
          />

          {!image && photo.status !== "preparing" ? (
            <label
              htmlFor={ids.file}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`mt-6 flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed px-6 py-10 text-center transition-colors focus-within:border-garland ${
                dragging ? "border-garland bg-garland/10" : "border-line bg-surface hover:border-garland/60"
              }`}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-garland/10 text-garland">
                <IconCamera className="h-7 w-7" />
              </span>
              <span className="text-lg font-semibold">
                <span className="md:hidden">Сфотографировать или выбрать</span>
                <span className="hidden md:inline">Перетащите фото сюда или выберите файл</span>
              </span>
              <span className="text-sm text-muted">JPG, PNG, WEBP или HEIC, до 15 МБ</span>
            </label>
          ) : (
            <div className="mt-6">
              <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-line bg-black">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- локальный blob, next/image не нужен
                  <img src={image.previewUrl} alt="Загруженное фото комнаты" className="max-h-[60vh] w-full object-contain" />
                ) : (
                  <div className="flex aspect-video items-center justify-center text-muted">Обрабатываем фото…</div>
                )}
                {(photo.status === "uploading" || photo.status === "preparing") && (
                  <div className="absolute inset-x-0 bottom-0 bg-night/80 p-3">
                    <div
                      className="h-2 overflow-hidden rounded-full bg-line"
                      role="progressbar"
                      aria-label="Загрузка фото"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={photo.status === "uploading" ? Math.round(photo.progress * 100) : 0}
                    >
                      <div
                        className="h-full rounded-full bg-garland transition-[width] duration-200"
                        style={{ width: `${photo.status === "uploading" ? Math.max(4, photo.progress * 100) : 4}%` }}
                      />
                    </div>
                    <p className="mt-2 text-center text-sm">{statusText}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {photo.status === "error" && (
            <div className="mt-4 rounded-xl border border-danger/40 bg-danger/10 p-4" role="alert">
              <p className="text-danger">{photo.message}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {photo.image && (
                  <Button variant="secondary" onClick={() => photo.image && void startUpload(photo.image)}>
                    Повторить загрузку
                  </Button>
                )}
                <Button variant="ghost" onClick={pickFile}>
                  Выбрать другое фото
                </Button>
              </div>
            </div>
          )}

          {needsPortraitConfirm && photo.status !== "error" && (
            <div className="mt-4 rounded-xl border border-garland/40 bg-garland/10 p-4" role="alert">
              <p>
                Лучше снять горизонтально — так видео будет выглядеть как запись с камеры. Продолжить с этим фото?
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => setPortraitOk(true)}>
                  Продолжить с этим фото
                </Button>
                <Button variant="ghost" onClick={pickFile}>
                  Заменить
                </Button>
              </div>
            </div>
          )}

          <details className="mt-6 rounded-[var(--radius-card)] border border-line bg-surface">
            <summary className="flex min-h-12 cursor-pointer list-none items-center px-5 font-semibold hover:text-garland [&::-webkit-details-marker]:hidden">
              Как снять фото
            </summary>
            <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
              {(["good", "bad"] as const).map((kind) => (
                <div key={kind}>
                  <p className={`font-semibold ${kind === "good" ? "text-success" : "text-danger"}`}>
                    {photoTips[kind].title}
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-muted">
                    {photoTips[kind].points.map((p) => (
                      <li key={p}>
                        {kind === "good" ? "✓" : "✕"} {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>

          <StickyBar>
            {image && (
              <Button variant="ghost" onClick={pickFile} className="shrink-0">
                Заменить
              </Button>
            )}
            <Button
              size="lg"
              className="flex-1 md:flex-none"
              disabled={!canContinue}
              onClick={() => setStep(1)}
            >
              Дальше
            </Button>
          </StickyBar>
        </section>
      )}

      {step === 1 && (
        <section className="mt-8" aria-labelledby="step-contacts">
          <h2 id="step-contacts" ref={headingRef} tabIndex={-1} className="text-2xl font-bold outline-none sm:text-3xl">
            Куда прислать видео
          </h2>
          <p className="mt-2 text-muted">
            Сначала покажем бесплатный кадр. Ссылку на заказ пришлём на почту — по ней можно вернуться с любого
            устройства.
          </p>

          <div className="mt-6">
            <label htmlFor={ids.email} className="block font-semibold">
              Email
            </label>
            <input
              id={ids.email}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? `${ids.email}-error` : undefined}
              className="mt-2 block min-h-12 w-full rounded-xl border border-line bg-surface px-4 text-base text-text placeholder:text-muted/70 focus:border-garland focus:outline-none aria-invalid:border-danger"
              placeholder="name@example.ru"
            />
            {fieldErrors.email && (
              <p id={`${ids.email}-error`} role="alert" className="mt-2 text-sm text-danger">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div className="mt-6 space-y-3">
            <Checkbox
              id={ids.personal}
              checked={consentPersonal}
              onChange={setConsentPersonal}
              error={fieldErrors.consentPersonal}
            >
              Согласен(на) на обработку персональных данных по{" "}
              <Link href="/privacy" target="_blank" className="text-garland underline underline-offset-2">
                политике конфиденциальности
              </Link>
            </Checkbox>
            <Checkbox id={ids.offer} checked={consentOffer} onChange={setConsentOffer} error={fieldErrors.consentOffer}>
              Принимаю условия{" "}
              <Link href="/offer" target="_blank" className="text-garland underline underline-offset-2">
                договора-оферты
              </Link>
            </Checkbox>
          </div>

          {submitError && (
            <div className="mt-6 rounded-xl border border-danger/40 bg-danger/10 p-4" role="alert">
              <p className="text-danger">{submitError}</p>
              <p className="mt-1 text-sm text-muted">Введённые данные сохранились — просто нажмите кнопку ещё раз.</p>
            </div>
          )}

          <p className="mt-6 text-sm text-muted">
            Видео стоит {priceRub}&nbsp;₽. Платить сейчас не нужно — сначала посмотрите кадр.
          </p>

          <StickyBar>
            <Button variant="ghost" onClick={() => setStep(0)} className="shrink-0">
              Назад
            </Button>
            <Button type="submit" size="lg" className="flex-1 md:flex-none" disabled={submitting} aria-busy={submitting}>
              {submitting ? "Создаём заказ…" : "Показать кадр бесплатно"}
            </Button>
          </StickyBar>
        </section>
      )}
    </form>
  );
}

/** На телефоне — панель с главной кнопкой, закреплённая внизу экрана. */
function StickyBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-night/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:static md:mt-8 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
      <div className="mx-auto flex max-w-2xl items-center gap-3 md:justify-end">{children}</div>
    </div>
  );
}

function Checkbox({
  id,
  checked,
  onChange,
  error,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 h-6 w-6 shrink-0 cursor-pointer accent-santa"
        />
        <label htmlFor={id} className="min-h-6 cursor-pointer leading-snug">
          {children}
        </label>
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 ml-9 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
