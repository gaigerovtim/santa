import { Redis } from "ioredis";
import { env } from "./env";

const globalForRedis = globalThis as unknown as { redis?: Redis };

/** Общее подключение к Redis (для BullMQ нужен maxRetriesPerRequest: null). */
export function redis(): Redis {
  if (!globalForRedis.redis) {
    globalForRedis.redis = new Redis(env().REDIS_URL, { maxRetriesPerRequest: null });
  }
  return globalForRedis.redis;
}
