import { describe, expect, it } from "vitest";
import { createOrderSchema, uploadUrlSchema } from "@/lib/schemas";
import { isHeicLike, isPortrait, MAX_UPLOAD_BYTES } from "@/lib/upload-rules";
import { newShareToken, SHARE_TOKEN_RE } from "@/lib/tokens";

const KEY = "uploads/2026-11-17/6f1c2a8e-1b2c-4d3e-8f90-0123456789ab.jpg";
const valid = { photoKey: KEY, email: " Test@Example.RU ", consentPersonal: true, consentOffer: true };

describe("создание заказа: схема", () => {
  it("принимает корректные данные и нормализует email", () => {
    const r = createOrderSchema.parse(valid);
    expect(r.email).toBe("test@example.ru");
  });

  it("отбрасывает цену и прочие лишние поля из браузера", () => {
    const r = createOrderSchema.parse({ ...valid, amountRub: 1, priceRub: 1, status: "paid" });
    expect(r).not.toHaveProperty("amountRub");
    expect(r).not.toHaveProperty("priceRub");
    expect(r).not.toHaveProperty("status");
  });

  it("без обоих согласий заказ не создаётся", () => {
    expect(createOrderSchema.safeParse({ ...valid, consentPersonal: false }).success).toBe(false);
    expect(createOrderSchema.safeParse({ ...valid, consentOffer: undefined }).success).toBe(false);
  });

  it.each([
    "uploads/../secret.jpg",
    "results/2026-11-17/6f1c2a8e-1b2c-4d3e-8f90-0123456789ab.jpg",
    "uploads/2026-11-17/not-a-uuid.jpg",
    "uploads/2026-11-17/6f1c2a8e-1b2c-4d3e-8f90-0123456789ab.exe",
  ])("отклоняет чужой или подозрительный ключ фото: %s", (photoKey) => {
    expect(createOrderSchema.safeParse({ ...valid, photoKey }).success).toBe(false);
  });

  it("отклоняет неверный email", () => {
    expect(createOrderSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });
});

describe("загрузка: схема и правила", () => {
  it("принимает JPG до 15 МБ", () => {
    expect(uploadUrlSchema.safeParse({ contentType: "image/jpeg", size: 1000 }).success).toBe(true);
  });

  it("отклоняет файл больше 15 МБ и неподходящий тип", () => {
    expect(uploadUrlSchema.safeParse({ contentType: "image/jpeg", size: MAX_UPLOAD_BYTES + 1 }).success).toBe(false);
    expect(uploadUrlSchema.safeParse({ contentType: "image/gif", size: 1000 }).success).toBe(false);
    expect(uploadUrlSchema.safeParse({ contentType: "image/heic", size: 1000 }).success).toBe(false);
  });

  it("определяет вертикальное фото", () => {
    expect(isPortrait(3024, 4032)).toBe(true);
    expect(isPortrait(4032, 3024)).toBe(false);
    expect(isPortrait(1000, 1000)).toBe(false);
  });

  it("распознаёт HEIC по типу и расширению", () => {
    expect(isHeicLike({ type: "image/heic", name: "a" })).toBe(true);
    expect(isHeicLike({ type: "", name: "IMG_0001.HEIC" })).toBe(true);
    expect(isHeicLike({ type: "image/jpeg", name: "a.jpg" })).toBe(false);
  });
});

describe("секретная ссылка", () => {
  it("не короче 32 символов и уникальна", () => {
    const a = newShareToken();
    const b = newShareToken();
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(SHARE_TOKEN_RE.test(a)).toBe(true);
    expect(a).not.toBe(b);
  });
});
