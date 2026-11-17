import { randomBytes } from "node:crypto";

/** Секретная ссылка на заказ: 32 байта → 43 символа base64url (ТЗ: 32+ символа). */
export function newShareToken(): string {
  return randomBytes(32).toString("base64url");
}

export const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{32,64}$/;
