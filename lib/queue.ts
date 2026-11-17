/**
 * Очереди BullMQ. preview — высокий приоритет (покупатель ждёт на странице), video — после оплаты.
 */
import { Queue } from "bullmq";
import { redis } from "./redis";

export const QUEUE_PREVIEW = "preview";
export const QUEUE_VIDEO = "video";
export const QUEUE_MAINTENANCE = "maintenance";

export interface OrderJobData {
  orderId: string;
}

const queues = new Map<string, Queue>();

export function getQueue(name: string): Queue {
  let q = queues.get(name);
  if (!q) {
    q = new Queue(name, {
      connection: redis(),
      defaultJobOptions: {
        removeOnComplete: { age: 7 * 24 * 3600, count: 1000 },
        removeOnFail: { age: 30 * 24 * 3600 },
      },
    });
    queues.set(name, q);
  }
  return q;
}
