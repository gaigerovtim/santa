/**
 * S3-совместимое хранилище: локально RustFS, в продакшене Yandex Object Storage.
 * Два клиента: внутренний (сервер ↔ хранилище) и публичный — только для подписи ссылок,
 * которые открывает браузер (адрес хранилища снаружи Docker отличается).
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost, type PresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "./env";

let internal: S3Client | null = null;
let publicClient: S3Client | null = null;

function makeClient(endpoint: string) {
  const e = env();
  return new S3Client({
    endpoint,
    region: e.S3_REGION,
    forcePathStyle: true,
    credentials: { accessKeyId: e.S3_ACCESS_KEY, secretAccessKey: e.S3_SECRET_KEY },
  });
}

export function s3(): S3Client {
  internal ??= makeClient(env().S3_ENDPOINT);
  return internal;
}

function s3Public(): S3Client {
  const e = env();
  publicClient ??= makeClient(e.S3_PUBLIC_ENDPOINT ?? e.S3_ENDPOINT);
  return publicClient;
}

export const bucket = () => env().S3_BUCKET;

/** Срок жизни временных ссылок: 15 минут (ТЗ, «Лимиты и защита»). */
export const SIGNED_URL_TTL_SEC = 15 * 60;

/**
 * Подписанная форма загрузки (POST policy): хранилище само проверит размер
 * и тип файла, обойти лимит из браузера нельзя.
 */
export async function presignUpload(params: {
  key: string;
  contentType: string;
  maxBytes: number;
}): Promise<PresignedPost> {
  return createPresignedPost(s3Public(), {
    Bucket: bucket(),
    Key: params.key,
    Conditions: [
      ["content-length-range", 1, params.maxBytes],
      ["eq", "$Content-Type", params.contentType],
    ],
    Fields: { "Content-Type": params.contentType },
    Expires: SIGNED_URL_TTL_SEC,
  });
}

/** Временная ссылка на скачивание (15 минут). */
export async function presignDownload(key: string, filename?: string): Promise<string> {
  return getSignedUrl(
    s3Public(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: filename ? `attachment; filename="${filename}"` : undefined,
    }),
    { expiresIn: SIGNED_URL_TTL_SEC },
  );
}

export async function headObject(key: string) {
  try {
    const res = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { size: res.ContentLength ?? 0, contentType: res.ContentType ?? "" };
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404 || (err as Error).name === "NotFound") return null;
    throw err;
  }
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!res.Body) throw new Error(`Пустой объект: ${key}`);
  return Buffer.from(await res.Body.transformToByteArray());
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  await s3().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }),
  );
}

export async function deleteObject(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
