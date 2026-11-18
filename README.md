# Дед Мороз у вашей ёлки

Сайт, где по фото комнаты делается «запись с камеры наблюдения»: Дед Мороз ночью кладёт подарок под ёлку.
Версия 1 — весь путь покупателя работает на заглушках, без нейросетей и боевой оплаты.

- ТЗ: [docs/spec-v1-site.md](docs/spec-v1-site.md)
- Принятые решения по ТЗ: [docs/decisions.md](docs/decisions.md)

## Запуск за 5 минут

Нужны Docker Desktop и git.

```bash
git clone https://github.com/gaigerovtim/santa.git
cd santa
docker compose up --build
```

Первый запуск собирает образы — 3–5 минут. Потом откройте:

| Что | Адрес |
| --- | --- |
| Сайт | http://localhost:3000 |
| Проверка живости (база и Redis) | http://localhost:3000/api/health |
| Письма (Mailpit) | http://localhost:8025 |
| Консоль хранилища (RustFS) | http://localhost:9001/rustfs/console/ — логин `santa-dev`, пароль `santa-dev-secret` |

Остановить: `Ctrl+C` или `docker compose down`. Удалить и данные: `docker compose down -v`.

Файл `.env` не обязателен: значения по умолчанию заданы в `docker-compose.yml`. Чтобы поменять настройки,
скопируйте `.env.example` в `.env` — описание каждой переменной внутри.

## Что запускается

| Сервис | Зачем |
| --- | --- |
| `web` | Сайт и API (Next.js) |
| `worker` | Очереди `preview` и `video`, ffmpeg, письма, очистка |
| `postgres` | База заказов |
| `redis` | Очереди BullMQ |
| `s3` | Хранилище файлов. В ТЗ — MinIO, но его образы больше не публикуются, поэтому используется совместимый RustFS |
| `mailpit` | Перехватчик писем |
| `migrate`, `s3-init` | Одноразовые: миграции базы, создание бакета. Завершаются после старта |

## Разработка без Docker для сайта

Инфраструктура в Docker, сайт и воркер — локально с горячей перезагрузкой (нужен Node.js 24+):

```bash
docker compose up -d postgres redis s3 s3-init mailpit
cp .env.example .env
npm install
npm run db:deploy
npm run dev          # сайт на http://localhost:3000
npm run worker       # воркер, в отдельном терминале
```

Если запущен весь `docker compose up`, а воркер вы хотите гонять локально, остановите контейнерный:
`docker compose stop worker` — иначе он заберёт задачи из очереди со старым кодом.

Проверить путь со сбоем генерации (статус «нужна помощь»):

```bash
MOCK_FAILURE_RATE=1 MOCK_IMAGE_DELAY_SEC=0 npm run worker
```

Второй фиктивный провайдер (проверка подключения нового сервиса без правок кода): `AI_PROVIDER=mock2` —
на кадре появится пометка «ДЕМО-2». Файлы-заглушки пересоздаются командой `npx tsx scripts/make-mock-assets.ts`.

## Команды

| Команда | Что делает |
| --- | --- |
| `npm run dev` | Сайт в режиме разработки |
| `npm run worker` | Воркер очередей |
| `npm test` | Unit-тесты (vitest) |
| `npm run lint` | Линтер |
| `npm run typecheck` | Проверка типов |
| `npm run test:e2e` | E2E на Playwright: iPhone 14 и компьютер 1440 px (нужен запущенный `docker compose`) |
| `npm run test:load` | Нагрузочный тест: 20 заказов одновременно до доставки (`LOAD_ORDERS=50` — больше) |
| `npm run db:migrate` | Новая миграция после правки `prisma/schema.prisma` |
| `npm run db:deploy` | Применить миграции |

## Тесты

```bash
npm run lint && npm run typecheck && npm test   # быстрые проверки, без Docker
docker compose up -d --build                     # стенд для e2e и нагрузки
npx playwright install chromium webkit           # один раз — браузеры для e2e
npm run test:e2e
npm run test:load
```

E2E и нагрузочный тест на время прогона ускоряют заглушки (хеш Redis `mock:config`) и выключают ручное
одобрение, а после — возвращают как было. Отчёт e2e: `npx playwright show-report`.

## Админка

http://localhost:3000/admin — пароль из `ADMIN_PASSWORD`. Список заказов с фильтром и поиском, счётчики за сегодня,
карточка заказа с файлами и историей, действия «Одобрить», «Перегенерировать», «Вернуть деньги», «Отправить письмо
повторно», переключатель «Ручное одобрение».

## Хранение и очистка

Воркер раз в сутки (04:00 МСК) удаляет исходные фото через 72 часа после доставки, видео — через 30 дней,
неоплаченные заказы через 7 дней переводит в «Истёк» и удаляет их файлы, загрузки без заказа — через 24 часа.

| Скрипт | Что делает |
| --- | --- |
| `docker compose exec worker npx tsx scripts/cleanup-now.ts` | Очистка прямо сейчас |
| `docker compose exec worker npx tsx scripts/requeue-paid.ts` | Поставить в очередь застрявшие оплаченные заказы |
| `npx tsx scripts/make-mock-assets.ts` | Пересоздать файлы-заглушки |

## Перед запуском в продакшене

- `ENABLE_MOCKS=false`, `NODE_ENV=production`; `ADMIN_PASSWORD` и `SESSION_SECRET` (от 32 символов) — длинные случайные.
- Сайт — за обратным прокси (nginx), который выставляет `X-Real-IP`: по нему считаются лимиты.
- Реквизиты и контакты — в `config/site.ts`, тексты оферты и политики — в `content/` (согласовать с юристом).
- Звук `assets/sfx/steps-bells.wav` — заменить звуком с коммерческой лицензией.

## Структура

```text
app/          страницы и API (Next.js App Router), app/admin — админка
components/   UI-компоненты: CameraFrame, Uploader (create/), OrderScreen (order/), admin/…
config/       tariffs.ts — тарифы и конвейер, prompts.ts — промпты, site.ts и home.ts — тексты
content/      offer.md, privacy.md
emails/       шаблоны писем
lib/          db, redis, queue, s3, mail, limits, transition, providers/ (точка подключения нейросетей и оплаты)
worker/       обработчики очередей и шаги конвейера (steps/)
assets/       mock/ — заглушки, sfx/ — звук, fonts/ — шрифт таймкода
prisma/       схема базы и миграции
tests/        unit/ (vitest), e2e/ (Playwright)
scripts/      нагрузочный тест, очистка, служебные скрипты
docker/       скрипты инициализации контейнеров
```

Статус заказа меняется только через `transition()` из `lib/transition.ts`: она проверяет, что переход
разрешён (`lib/order-status.ts`), и пишет запись в историю `order_events`.

## Автосохранение в git

В `.claude/settings.json` настроен хук: после каждого ответа Claude Code изменения коммитятся
и отправляются в GitHub. Отключить — удалить блок `Stop` из этого файла.
