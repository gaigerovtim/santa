/** Отправка писем через SMTP (Nodemailer). Локально — Mailpit: http://localhost:8025 */
import nodemailer, { type Transporter } from "nodemailer";
import type { EmailContent } from "@/emails/layout";
import { env } from "./env";

let transport: Transporter | null = null;

function getTransport(): Transporter {
  transport ??= nodemailer.createTransport(env().SMTP_URL);
  return transport;
}

export async function sendMail(to: string, content: EmailContent): Promise<void> {
  await getTransport().sendMail({
    from: env().MAIL_FROM,
    to,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });
}
