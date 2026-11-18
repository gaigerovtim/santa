/** Заглушка видео: через MOCK_VIDEO_DELAY_SEC возвращает готовый ролик assets/mock/clip.mp4. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { VideoProvider } from "../types";
import { MOCK_DIR, getMockConfig, maybeFail, mockDelay } from "./common";

export const mockVideoProvider: VideoProvider = {
  name: "mock",
  async imageToVideo({ seconds }) {
    const cfg = await getMockConfig();
    await mockDelay(cfg.videoDelaySec);
    maybeFail("видео", cfg.failureRate);
    const video = await readFile(path.join(MOCK_DIR, "clip.mp4"));
    // Условная стоимость: как у видеомодели около $0.05 за секунду.
    return { video, costUsd: Number((seconds * 0.05).toFixed(4)) };
  },
};
