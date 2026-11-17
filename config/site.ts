/**
 * Тексты, контакты и реквизиты для витрины.
 * ЗАГЛУШКИ (docs/decisions.md, п. 3): заменить настоящими данными перед запуском.
 */
import { tariffs } from "./tariffs";

export const site = {
  name: "Дед Мороз у вашей ёлки",
  shortName: "Дед Мороз",
  description:
    "Пришлите фото комнаты — мы сделаем запись с камеры наблюдения, где Дед Мороз ночью кладёт подарок под вашу ёлку.",
  mainTariff: "camera_visit" as const,
  get mainPriceRub() {
    return tariffs.camera_visit.priceRub;
  },
  deliveryTime: "10–15 минут",
  copyrightYear: 2026,
  contacts: {
    email: "hello@example.ru", // ЗАГЛУШКА
    telegram: "@example", // ЗАГЛУШКА
  },
  requisites: {
    // ЗАГЛУШКА — реквизиты самозанятого
    name: "Иванов Иван Иванович",
    status: "Самозанятый (плательщик НПД)",
    inn: "000000000000",
  },
} as const;
