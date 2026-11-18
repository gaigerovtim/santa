/** Три письма из ТЗ: «Заказ оплачен», «Видео готово», «Немного задерживаемся». */
import { site } from "@/config/site";
import { renderLayout, renderText, type EmailContent } from "./layout";

interface OrderEmailData {
  orderUrl: string;
  amountRub: number;
}

function build(subject: string, params: Parameters<typeof renderLayout>[0]): EmailContent {
  return { subject, html: renderLayout(params), text: renderText(params) };
}

export function paidEmail({ orderUrl, amountRub }: OrderEmailData): EmailContent {
  return build("Заказ оплачен — Дед Мороз уже в пути", {
    preheader: `Видео придёт на эту почту за ${site.deliveryTime}.`,
    eyebrow: "Оплата получена",
    title: "Дед Мороз уже в пути",
    paragraphs: [
      `Спасибо! Оплата ${amountRub} ₽ прошла. Мы готовим запись с камеры, где Дед Мороз приносит подарок под вашу ёлку.`,
      `Видео придёт на эту почту за ${site.deliveryTime}. За ходом можно следить на странице заказа.`,
    ],
    button: { label: "Открыть заказ", url: orderUrl },
    footnote: "Сохраните это письмо — по ссылке можно вернуться к заказу с любого устройства.",
  });
}

export function readyEmail({ orderUrl }: OrderEmailData): EmailContent {
  return build("Ваше видео с Дедом Морозом готово", {
    preheader: "Запись с камеры готова — смотрите и скачивайте.",
    eyebrow: "Запись готова",
    title: "Ваше видео готово",
    paragraphs: [
      "Камера в гостиной кое-что засняла этой ночью. Видео можно посмотреть, скачать и отправить близким.",
      "Совет: покажите его утром 1 января на телевизоре — так «запись с камеры» выглядит убедительнее всего.",
    ],
    button: { label: "Смотреть видео", url: orderUrl },
    footnote: "Видео хранится 30 дней — скачайте его, чтобы не потерять.",
  });
}

export function delayedEmail({ orderUrl }: OrderEmailData): EmailContent {
  return build("Немного задерживаемся с вашим заказом", {
    preheader: "Мы уже разбираемся — видео придёт на почту.",
    eyebrow: "Немного задерживаемся",
    title: "Мы уже разбираемся",
    paragraphs: [
      "С вашим заказом что-то пошло не так, но мы уже смотрим и всё поправим вручную.",
      "Как только видео будет готово, пришлём его на эту почту. Если что-то не получится — вернём деньги.",
    ],
    button: { label: "Открыть заказ", url: orderUrl },
  });
}
