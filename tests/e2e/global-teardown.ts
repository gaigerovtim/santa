import { clearMockConfig, setManualApproval } from "./helpers";

/** Возвращаем стенд как было: заглушки из .env, ручное одобрение включено. */
export default async function globalTeardown() {
  await clearMockConfig();
  await setManualApproval(true);
}
