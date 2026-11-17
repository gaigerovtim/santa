/**
 * Переменные окружения с проверкой. Описание каждой — в .env.example.
 * Читается лениво, чтобы сборка Next.js не требовала всех переменных.
 */
import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),

  S3_ENDPOINT: z.string().url().default("http://localhost:9000"),
  S3_PUBLIC_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("ru-central1"),
  S3_BUCKET: z.string().default("dedmoroz"),
  S3_ACCESS_KEY: z.string().default(""),
  S3_SECRET_KEY: z.string().default(""),

  SMTP_URL: z.string().default("smtp://localhost:1025"),
  MAIL_FROM: z.string().default("Дед Мороз <video@example.ru>"),
  ADMIN_PASSWORD: z.string().default(""),
  SESSION_SECRET: z.string().default(""),
  IP_HASH_SALT: z.string().default(""),

  AI_PROVIDER: z.enum(["mock", "mock2", "fal"]).default("mock"),
  PAYMENT_PROVIDER: z.enum(["mock", "yookassa"]).default("mock"),
  MOCK_IMAGE_DELAY_SEC: z.coerce.number().min(0).default(8),
  MOCK_VIDEO_DELAY_SEC: z.coerce.number().min(0).default(30),
  MOCK_FAILURE_RATE: z.coerce.number().min(0).max(1).default(0),
  ENABLE_MOCKS: bool.default(false),
  FAL_KEY: z.string().default(""),
  YOOKASSA_SHOP_ID: z.string().default(""),
  YOOKASSA_SECRET_KEY: z.string().default(""),

  VIDEO_CONCURRENCY: z.coerce.number().int().min(1).default(5),
  PREVIEW_CONCURRENCY: z.coerce.number().int().min(1).default(10),
  MANUAL_APPROVAL: bool.default(true),
  ORDERS_ENABLED: bool.default(true),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Неверные переменные окружения: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Страница /mock-pay и заглушки доступны вне продакшена или по явному флагу. */
export function mocksAllowed(e: Pick<Env, "NODE_ENV" | "ENABLE_MOCKS"> = env()): boolean {
  return e.NODE_ENV !== "production" || e.ENABLE_MOCKS;
}
