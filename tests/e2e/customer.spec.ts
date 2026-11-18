import { expect, test } from "@playwright/test";
import { clearMockConfig, createOrderViaUi, freshIdentity, mailsFor, payViaMock, setMockConfig } from "./helpers";

test.describe("покупатель", () => {
  test("весь путь: главная → фото → кадр → оплата → видео и письмо", async ({ page }) => {
    const { email } = await freshIdentity(page);

    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Дед Мороз придёт к вашей ёлке");
    await page.getByRole("link", { name: /Сделать видео за 390/ }).first().click();
    await page.waitForURL("**/create");

    const token = await createOrderViaUi(page, email);
    expect(token.length).toBeGreaterThanOrEqual(32);

    // Экран ожидания сменяется кадром без перезагрузки страницы
    await expect(page.getByRole("heading", { name: "Ваш кадр готов" })).toBeVisible();
    await expect(page.getByRole("img", { name: /Кадр-превью/ })).toBeVisible();

    await payViaMock(page, "Оплатить");
    await expect(page.getByRole("heading", { name: /Дед Мороз уже в пути|Ваше видео готово/ })).toBeVisible();

    // Видео готово: плеер, скачивание, «Поделиться»
    await expect(page.getByRole("heading", { name: "Ваше видео готово" })).toBeVisible({ timeout: 90_000 });
    const video = page.locator("video");
    await expect(video).toHaveAttribute("src", /final\.mp4/);
    await expect(page.getByRole("link", { name: "Скачать MP4" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Поделиться" })).toBeVisible();

    // Письма в Mailpit: «оплачено» и «готово»
    await expect.poll(() => mailsFor(email), { timeout: 15_000 }).toEqual(
      expect.arrayContaining(["Заказ оплачен — Дед Мороз уже в пути", "Ваше видео с Дедом Морозом готово"]),
    );
  });

  test("перегенерация кадра — один раз бесплатно", async ({ page }) => {
    const { email } = await freshIdentity(page);
    await createOrderViaUi(page, email);
    await expect(page.getByRole("heading", { name: "Ваш кадр готов" })).toBeVisible();

    const regen = page.getByRole("button", { name: /Перегенерировать кадр/ });
    await regen.click();
    await expect(page.getByRole("heading", { name: "Ваш кадр готов" })).toBeVisible();
    await expect(regen).toHaveCount(0);
  });

  test("отказ от оплаты — заказ ждёт, деньги не списаны", async ({ page }) => {
    const { email } = await freshIdentity(page);
    await createOrderViaUi(page, email);
    await expect(page.getByRole("heading", { name: "Ваш кадр готов" })).toBeVisible();

    await payViaMock(page, "Отказаться");
    await expect(page.getByText("Оплата отменена — деньги не списаны")).toBeVisible();
    await expect(page.getByRole("button", { name: /Оплатить \d+ ₽ и получить видео/ })).toBeVisible();
    expect(await mailsFor(email)).toEqual([]);
  });

  test("ошибка генерации → «Немного задерживаемся» и письмо", async ({ page }) => {
    const { email } = await freshIdentity(page);
    await setMockConfig({ failure_rate: 1 });
    try {
      await createOrderViaUi(page, email);
      await expect(page.getByRole("heading", { name: "Мы уже разбираемся" })).toBeVisible({ timeout: 60_000 });
    } finally {
      await setMockConfig({ failure_rate: 0 });
    }
    await expect.poll(() => mailsFor(email), { timeout: 15_000 }).toContain("Немного задерживаемся с вашим заказом");
  });

  test.afterAll(async () => {
    // На случай падения теста посередине — заглушки снова быстрые и надёжные
    await clearMockConfig();
    await setMockConfig({ image_delay: 0.5, video_delay: 1, failure_rate: 0 });
  });
});
