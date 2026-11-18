import { setManualApproval, setMockConfig } from "./helpers";

/** Быстрые заглушки для тестов и автоматическая доставка видео (ручное одобрение выключено). */
export default async function globalSetup() {
  await setMockConfig({ image_delay: 0.5, video_delay: 1, failure_rate: 0 });
  await setManualApproval(false);
}
