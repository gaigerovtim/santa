import { expect, test } from "@playwright/test";
import { ADMIN_PASSWORD, BASE_URL, createOrderViaUi, freshIdentity, mailsFor, payViaMock, setManualApproval } from "./helpers";

test.describe("админка", () => {
  test.beforeAll(async () => setManualApproval(true));
  test.afterAll(async () => setManualApproval(false));

  test("вход, поиск заказа и одобрение видео", async ({ page, browser }) => {
    // Покупатель оплачивает — видео ждёт одобрения
    const { email } = await freshIdentity(page);
    const token = await createOrderViaUi(page, email);
    await expect(page.getByRole("heading", { name: "Ваш кадр готов" })).toBeVisible();
    await payViaMock(page);
    await expect(page.getByRole("heading", { name: "Дед Мороз уже в пути" })).toBeVisible();

    // Администратор — в отдельном окне браузера
    const admin = await browser.newPage({ baseURL: BASE_URL, viewport: page.viewportSize() ?? undefined });
    await freshIdentity(admin);
    await admin.goto("/admin");
    await admin.waitForURL("**/admin/login");
    await admin.getByLabel("Пароль").fill(ADMIN_PASSWORD);
    await admin.getByRole("button", { name: "Войти" }).click();
    await expect(admin.getByRole("heading", { name: "Заказы" })).toBeVisible();

    await admin.getByLabel("Поиск по email").fill(email);
    await admin.getByRole("button", { name: "Показать" }).click();
    await admin.getByRole("link", { name: email }).first().click();
    await expect(admin.getByRole("heading", { name: email })).toBeVisible();

    // Ждём, пока видео будет готово и заказ встанет на одобрение
    const approve = admin.getByRole("button", { name: "Одобрить" });
    await expect(async () => {
      await admin.reload();
      await expect(approve).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 90_000 });
    await approve.click();
    await expect(admin.getByText("Одобрено: видео доставлено, письмо отправлено")).toBeVisible();

    // Покупатель видит видео, письмо ушло
    await page.goto(`/order/${token}`);
    await expect(page.getByRole("heading", { name: "Ваше видео готово" })).toBeVisible();
    await expect.poll(() => mailsFor(email), { timeout: 15_000 }).toContain("Ваше видео с Дедом Морозом готово");
    await admin.close();
  });
});
