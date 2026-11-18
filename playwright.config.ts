/**
 * E2E-тесты (Playwright) на запущенном docker compose: http://localhost:3000.
 * Телефон — профиль iPhone 14 (WebKit), компьютер — Chromium 1440×900.
 * Тесты идут по одному: часть из них меняет общие настройки заглушек и ручного одобрения.
 *   docker compose up -d --build
 *   npm run test:e2e
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "ru-RU",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "iphone-14", use: { ...devices["iPhone 14"] } },
    { name: "desktop-1440", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
});
