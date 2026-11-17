/** Файлы заказа в хранилище: orders/<orderId>/<id>.<ext>; ключи — в orders.artifacts. */
import type { ArtifactId } from "@/config/tariffs";

/** room — подготовленное фото комнаты (служебный шаг prepareRoomPhoto). */
export type ArtifactKey = ArtifactId | "room";
export type Artifacts = Partial<Record<ArtifactKey, string>>;

export function artifactKey(orderId: string, id: ArtifactKey, ext: "jpg" | "mp4") {
  return `orders/${orderId}/${id}.${ext}`;
}

export function parseArtifacts(value: unknown): Artifacts {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Artifacts = {};
  for (const [k, v] of Object.entries(value)) if (typeof v === "string") out[k as ArtifactKey] = v;
  return out;
}
