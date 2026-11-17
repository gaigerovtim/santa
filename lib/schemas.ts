/** Схемы входящих данных API (zod). Цена в запросах не принимается — только из конфига. */
import { z } from "zod";
import { ALLOWED_UPLOAD_TYPES, MAX_UPLOAD_BYTES } from "./upload-rules";

export const uploadUrlSchema = z.object({
  contentType: z.enum(ALLOWED_UPLOAD_TYPES),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

export const createOrderSchema = z
  .object({
    photoKey: z.string().regex(/^uploads\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp)$/),
    email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
    consentPersonal: z.literal(true),
    consentOffer: z.literal(true),
    tariff: z.string().max(64).optional(),
  })
  // Лишние поля (например, amountRub) молча отбрасываем — сервер их не читает.
  .strip();

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

/** Человекочитаемые ошибки для формы. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    if (out[field]) continue;
    out[field] =
      field === "email"
        ? "Проверьте адрес почты"
        : field === "consentPersonal"
          ? "Нужно согласие на обработку данных"
          : field === "consentOffer"
            ? "Нужно согласие с офертой"
            : field === "photoKey"
              ? "Загрузите фото ещё раз"
              : "Проверьте данные";
  }
  return out;
}
