/**
 * Конвейер: выполняет шаги тарифа по порядку. Каждый шаг пишет результат
 * в хранилище и в orders.artifacts под своим id. Провайдеры вызываются через
 * общую обёртку (таймаут, повторы, стоимость).
 */
import { Prisma } from "@prisma/client";
import { prompts } from "@/config/prompts";
import type { Step, Tariff } from "@/config/tariffs";
import { artifactKey, parseArtifacts, type ArtifactKey, type Artifacts } from "@/lib/artifacts";
import { db } from "@/lib/db";
import { callProvider } from "@/lib/providers/call";
import { getImageProvider, getVideoProvider } from "@/lib/providers";
import { getObjectBuffer, putObject } from "@/lib/s3";
import { makeWatermarkedPreview } from "@/lib/watermark";
import { postprocessCamera } from "./steps/postprocess";
import { prepareRoomPhoto } from "./steps/prepare-room-photo";

const IMAGE_TIMEOUT_MS = 3 * 60 * 1000;
const VIDEO_TIMEOUT_MS = 10 * 60 * 1000;

export interface PipelineContext {
  orderId: string;
  tariff: Tariff;
  roomPhotoKey: string;
  artifacts: Artifacts;
}

async function saveArtifact(
  ctx: PipelineContext,
  id: ArtifactKey,
  body: Buffer,
  kind: "jpg" | "mp4",
): Promise<void> {
  const key = artifactKey(ctx.orderId, id, kind);
  await putObject(key, body, kind === "jpg" ? "image/jpeg" : "video/mp4");
  ctx.artifacts = { ...ctx.artifacts, [id]: key };
  await db.order.update({
    where: { id: ctx.orderId },
    data: { artifacts: ctx.artifacts as Prisma.InputJsonObject },
  });
}

async function loadArtifact(ctx: PipelineContext, id: ArtifactKey): Promise<Buffer> {
  const key = ctx.artifacts[id];
  if (!key) throw new Error(`Шаг ждёт результат «${id}», но его нет`);
  return getObjectBuffer(key);
}

/** Учёт генераций и стоимости в заказе. */
function costTracking(orderId: string) {
  return {
    onSuccess: async (result: { costUsd: number }) => {
      await db.order.update({
        where: { id: orderId },
        data: { attempts: { increment: 1 }, costUsd: { increment: result.costUsd } },
      });
    },
    onAttemptFailed: async () => {
      await db.order.update({ where: { id: orderId }, data: { attempts: { increment: 1 } } });
    },
  };
}

export async function runStep(ctx: PipelineContext, step: Step): Promise<void> {
  switch (step.type) {
    case "prepareRoomPhoto": {
      const original = await getObjectBuffer(ctx.roomPhotoKey);
      await saveArtifact(ctx, "room", await prepareRoomPhoto(original), "jpg");
      return;
    }

    case "editFrame": {
      const base = await loadArtifact(ctx, step.from ?? "room");
      const provider = getImageProvider();
      const { image } = await callProvider(
        () => provider.editImage({ images: [base], prompt: prompts[step.prompt], aspectRatio: "16:9" }),
        { label: `editFrame:${step.id}:${provider.name}`, timeoutMs: IMAGE_TIMEOUT_MS, ...costTracking(ctx.orderId) },
      );
      await saveArtifact(ctx, step.id, image, "jpg");
      if (step.id === ctx.tariff.previewFrom) {
        await saveArtifact(ctx, "preview", await makeWatermarkedPreview(image), "jpg");
      }
      return;
    }

    case "imageToVideo": {
      const firstFrame = await loadArtifact(ctx, step.first);
      const lastFrame = step.last ? await loadArtifact(ctx, step.last) : undefined;
      const provider = getVideoProvider();
      const { video } = await callProvider(
        () =>
          provider.imageToVideo({
            firstFrame,
            lastFrame,
            prompt: prompts[step.prompt],
            negativePrompt: prompts.video_negative,
            seconds: step.seconds,
            resolution: "720p",
          }),
        { label: `imageToVideo:${step.id}:${provider.name}`, timeoutMs: VIDEO_TIMEOUT_MS, ...costTracking(ctx.orderId) },
      );
      await saveArtifact(ctx, step.id, video, "mp4");
      return;
    }

    case "postprocess": {
      // По умолчанию обрабатываем результат предыдущего видеошага (clip).
      const clip = await loadArtifact(ctx, "clip");
      const started = Date.now();
      const final = await postprocessCamera(clip);
      console.log(`[postprocess] заказ ${ctx.orderId}: ${step.preset} за ${Date.now() - started} мс`);
      await saveArtifact(ctx, step.id, final, "mp4");
      return;
    }
  }
}

export async function loadContext(orderId: string, tariff: Tariff): Promise<PipelineContext> {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (!order.roomPhotoKey) throw new Error("У заказа нет фото комнаты");
  return {
    orderId,
    tariff,
    roomPhotoKey: order.roomPhotoKey,
    artifacts: parseArtifacts(order.artifacts),
  };
}

export async function runSteps(ctx: PipelineContext, steps: readonly Step[]): Promise<void> {
  for (const step of steps) await runStep(ctx, step);
}
