/** Заглушка видео: через MOCK_VIDEO_DELAY_SEC возвращает готовый ролик assets/mock/clip.mp4. */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";
import type { VideoProvider } from "../types";
import { MOCK_DIR, maybeFail, mockDelay } from "./common";

export const mockVideoProvider: VideoProvider = {
  name: "mock",
  async imageToVideo({ seconds }) {
    await mockDelay(env().MOCK_VIDEO_DELAY_SEC);
    maybeFail("видео");
    const video = await readFile(path.join(MOCK_DIR, "clip.mp4"));
    // Условная стоимость: как у видеомодели около $0.05 за секунду.
    return { video, costUsd: Number((seconds * 0.05).toFixed(4)) };
  },
};
