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
| `npm run db:migrate` | Новая миграция после правки `prisma/schema.prisma` |
| `npm run db:deploy` | Применить миграции |

## Структура

```text
app/          страницы и API (Next.js App Router)
config/       tariffs.ts — тарифы и конвейер, prompts.ts — промпты, site.ts — тексты и реквизиты
lib/          db, redis, queue, env, transition (смена статусов заказа)
worker/       обработчики очередей
prisma/       схема базы и миграции
tests/        unit-тесты
docker/       скрипты инициализации контейнеров
```

Статус заказа меняется только через `transition()` из `lib/transition.ts`: она проверяет, что переход
разрешён (`lib/order-status.ts`), и пишет запись в историю `order_events`.

## Автосохранение в git

В `.claude/settings.json` настроен хук: после каждого ответа Claude Code изменения коммитятся
и отправляются в GitHub. Отключить — удалить блок `Stop` из этого файла.
