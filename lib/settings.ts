/**
 * Настройки, которые меняются из админки (docs/decisions.md, п. 2):
 * MANUAL_APPROVAL в .env — начальное значение; после переключения в админке действует значение из базы.
 */
import { db } from "./db";
import { env } from "./env";

const MANUAL_APPROVAL = "manual_approval";

export async function getManualApproval(): Promise<boolean> {
  const row = await db.setting.findUnique({ where: { key: MANUAL_APPROVAL } });
  return typeof row?.value === "boolean" ? row.value : env().MANUAL_APPROVAL;
}

export async function setManualApproval(value: boolean): Promise<void> {
  await db.setting.upsert({
    where: { key: MANUAL_APPROVAL },
    create: { key: MANUAL_APPROVAL, value },
    update: { value },
  });
}
