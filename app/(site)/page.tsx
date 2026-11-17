import { Accordion } from "@/components/Accordion";
import { ButtonLink } from "@/components/Button";
import { CameraFrame } from "@/components/CameraFrame";
import { Carousel } from "@/components/Carousel";
import { IconArrowRight, IconCheck, IconCross, stepIcons } from "@/components/icons";
import { LazyVideo } from "@/components/LazyVideo";
import { RoomIllustration } from "@/components/RoomIllustration";
import { Section } from "@/components/Section";
import { SiteHeader } from "@/components/SiteHeader";
import { Snowfall } from "@/components/Snowfall";
import { examples, faq, hero, photoTips, priceCard, steps } from "@/config/home";
import { site } from "@/config/site";
import { tariffs } from "@/config/tariffs";

const EXAMPLE_VIDEO = { src: "/media/example.mp4", poster: "/media/example-poster.webp" };

const tariff = tariffs[site.mainTariff];
const ctaLabel = `Сделать видео за ${tariff.priceRub} ₽`;

export default function HomePage() {
  return (
    <main>
      {/* 1. Первый экран */}
      <section className="relative isolate overflow-hidden pt-20 pb-14 sm:pt-28 sm:pb-20" aria-labelledby="hero-title">
        <div
          className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_75%_40%,rgb(242_196_109/0.14),transparent_70%),radial-gradient(50%_40%_at_10%_90%,rgb(200_16_46/0.12),transparent_70%)]"
          aria-hidden="true"
        />
        <Snowfall />
        <SiteHeader />

        {/* Телефон: заголовок → видео → кнопка. Компьютер: текст и кнопка слева, видео справа. */}
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:grid-rows-[auto_auto] lg:gap-x-12 lg:gap-y-8">
          <div className="max-w-xl lg:self-end">
            <h1 id="hero-title" className="text-[2.1rem] leading-[1.12] font-bold sm:text-5xl lg:text-[3.4rem]">
              {hero.title}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-muted sm:text-xl">{hero.subtitle}</p>
          </div>

          <div className="max-w-xl lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:max-w-none lg:self-center">
            <CameraFrame className="lg:rotate-[0.6deg]">
              <LazyVideo
                {...EXAMPLE_VIDEO}
                label="Пример видео: Дед Мороз кладёт подарок под ёлку"
                eager
                sizes="(min-width: 1024px) 50vw, (min-width: 640px) 576px, 100vw"
              />
            </CameraFrame>
          </div>

          <div className="flex max-w-xl flex-col items-stretch gap-3 sm:items-start lg:self-start">
            <ButtonLink href="/create" size="lg" className="w-full sm:w-auto">
              {ctaLabel}
            </ButtonLink>
            <p className="text-center text-sm text-muted sm:text-left">{hero.note}</p>
          </div>
        </div>
      </section>

      {/* 2. Как это работает */}
      <Section id="how" eyebrow="Три шага" title="Как это работает">
        <ol className="grid gap-4 md:grid-cols-3 md:gap-6">
          {steps.map((step, i) => {
            const Icon = stepIcons[step.icon];
            return (
              <li key={step.title} className="relative rounded-[var(--radius-card)] border border-line bg-surface p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-garland/10 text-garland">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="font-mono text-sm text-muted">0{i + 1}</span>
                </div>
                <h3 className="mt-5 font-sans text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 leading-relaxed text-muted">{step.text}</p>
              </li>
            );
          })}
        </ol>
      </Section>

      {/* 3. Примеры */}
      <Section id="examples" eyebrow="Записи с камер" title="Примеры" intro="Так выглядят ролики, которые приходят на почту.">
        <Carousel label="Примеры видео">
          {examples.map((ex) => (
            <div key={ex.label}>
              <CameraFrame label={ex.label} start={ex.start}>
                <LazyVideo {...EXAMPLE_VIDEO} label={`Пример видео: ${ex.caption}`} sizes="(min-width: 768px) 33vw, 82vw" />
              </CameraFrame>
              <p className="mt-3 text-sm text-muted">{ex.caption}</p>
            </div>
          ))}
        </Carousel>
      </Section>

      {/* 4. Как снять фото */}
      <Section
        id="photo"
        eyebrow="Подсказка"
        title="Как снять фото"
        intro="От фото зависит, насколько живым получится видео. Хватит минуты."
      >
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
          {(["good", "bad"] as const).map((kind) => {
            const tip = photoTips[kind];
            const good = kind === "good";
            return (
              <figure key={kind} className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
                <div className="relative aspect-video">
                  <RoomIllustration variant={kind} />
                </div>
                <figcaption className="p-5 sm:p-6">
                  <p className={`flex items-center gap-2 font-semibold ${good ? "text-success" : "text-danger"}`}>
                    {good ? <IconCheck className="h-5 w-5" /> : <IconCross className="h-5 w-5" />}
                    {tip.title}
                  </p>
                  <ul className="mt-3 space-y-1.5 text-muted">
                    {tip.points.map((p) => (
                      <li key={p} className="flex gap-2">
                        <span aria-hidden="true" className={good ? "text-success" : "text-danger"}>
                          {good ? "✓" : "✕"}
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </Section>

      {/* 5. Цена */}
      <Section id="price" eyebrow="Цена" title="Один тариф, без доплат">
        <div className="relative mx-auto max-w-xl overflow-hidden rounded-[var(--radius-card)] border border-garland/40 bg-surface p-6 shadow-glow sm:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-2xl font-bold">{tariff.title}</h3>
            <p className="font-display text-4xl font-bold text-garland">
              {tariff.priceRub}&nbsp;₽
            </p>
          </div>
          <ul className="mt-6 space-y-3">
            {priceCard.includes.map((item) => (
              <li key={item} className="flex gap-3">
                <IconCheck className="mt-0.5 h-5 w-5 shrink-0 text-garland" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <ButtonLink href="/create" size="lg" className="mt-8 w-full">
            {ctaLabel}
          </ButtonLink>
          <p className="mt-3 text-center text-sm text-muted">Платите после бесплатного кадра</p>
        </div>
      </Section>

      {/* 6. Вопросы и ответы */}
      <Section id="faq" eyebrow="FAQ" title="Вопросы и ответы">
        <div className="max-w-3xl">
          <Accordion items={faq} />
        </div>
      </Section>

      {/* Финальный призыв */}
      <section className="pb-16 sm:pb-24" aria-label="Заказать видео">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-start gap-5 rounded-[var(--radius-card)] border border-line bg-[linear-gradient(135deg,var(--color-surface),var(--color-surface-2))] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-10">
            <p className="font-display text-2xl font-bold sm:text-3xl">Пусть утром 1 января будет что показать</p>
            <ButtonLink href="/create" size="lg" className="w-full shrink-0 sm:w-auto">
              Начать <IconArrowRight className="h-5 w-5" />
            </ButtonLink>
          </div>
        </div>
      </section>
    </main>
  );
}
