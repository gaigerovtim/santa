/**
 * Промпты для нейросетей. В версии 1 не используются (работают mock-провайдеры).
 * ЧЕРНОВИК: финальные тексты нужно перенести из spec-stage1.md (docs/decisions.md, п. 6).
 */
export const prompts = {
  frameA_visit:
    "Night-vision security camera still of this exact living room. Santa Claus (Ded Moroz, " +
    "long red coat, white beard, staff) kneels by the Christmas tree and places a wrapped gift " +
    "under it. Keep room layout, furniture and lighting unchanged. Warm garland glow.",
  frameB_remove:
    "The same frame, but Santa Claus has left: the room is empty, the new wrapped gift remains " +
    "under the tree. Nothing else changes.",
  video_visit_camera:
    "Static security camera footage, fixed wide angle, no camera movement. Santa Claus quietly " +
    "puts a gift under the Christmas tree, looks around and walks out of frame.",
  video_negative: "camera movement, zoom, cuts, text, extra people, distorted faces",
} as const;

export type PromptKey = keyof typeof prompts;
