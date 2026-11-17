/**
 * Уведомления покупателю. Письма появятся на этапе 6; пока — запись в лог,
 * чтобы конвейер уже вызывал уведомления в нужных местах.
 */
export async function notifyNeedsHelp(order: { id: string; email: string }): Promise<void> {
  console.warn(`[notify] заказ ${order.id}: нужна помощь — письмо «Немного задерживаемся» на ${order.email} (этап 6)`);
}
