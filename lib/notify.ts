/**
 * Уведомления покупателю письмами. Ошибка отправки не ломает конвейер и оплату:
 * пишется в лог, заказ продолжает жить (письмо можно отправить повторно из админки).
 */
import { delayedEmail, paidEmail, readyEmail } from "@/emails/templates";
import type { EmailContent } from "@/emails/layout";
import { env } from "./env";
import { sendMail } from "./mail";

export interface NotifyOrder {
  id: string;
  email: string;
  shareToken: string;
  amountRub: number;
}

export type EmailKind = "paid" | "ready" | "delayed";

const TEMPLATES: Record<EmailKind, (d: { orderUrl: string; amountRub: number }) => EmailContent> = {
  paid: paidEmail,
  ready: readyEmail,
  delayed: delayedEmail,
};

export function orderUrl(shareToken: string) {
  return `${env().APP_URL.replace(/\/$/, "")}/order/${shareToken}`;
}

/** Отправляет письмо; возвращает true, если ушло. */
export async function notify(kind: EmailKind, order: NotifyOrder): Promise<boolean> {
  try {
    const content = TEMPLATES[kind]({ orderUrl: orderUrl(order.shareToken), amountRub: order.amountRub });
    await sendMail(order.email, content);
    console.log(`[mail] заказ ${order.id}: письмо «${kind}» отправлено`);
    return true;
  } catch (err) {
    console.error(`[mail] заказ ${order.id}: письмо «${kind}» не отправлено —`, (err as Error).message);
    return false;
  }
}

export const notifyPaid = (o: NotifyOrder) => notify("paid", o);
export const notifyReady = (o: NotifyOrder) => notify("ready", o);
export const notifyNeedsHelp = (o: NotifyOrder) => notify("delayed", o);
